const { Logger } = require("colourlogger");
const { inspect } = require("util");
const EventEmitter = require("events");

const RedisConnection = require("./conn");
const { ConnectionError } = require("./errors");


class RedisPoolEventEmitter extends EventEmitter {}


class RedisConnectionPool extends Logger {
  /**
   * Attribute `this.connections` is the "pool", it holds all redis connections.
   * And `this.emitter` give clients the ability to *wait* for connections.
   */
  constructor(config) {
    super("RedisConnectionPool");
    this.config = Object.assign({ connectionLimit: 10 }, config);

    this.queue = [];
    this.connections = [];
    this.poolSize = 0;
    this.brokenCnt = 0;

    const emitter = new RedisPoolEventEmitter();
    emitter.on("release", this.queueHandler.bind(this));

    this.emitter = emitter;

    this.nolog = false;

    this.initializeBrokenChecker();
  }


  /**
   * As this function is executed asynchronously, the `free` flag should be
   * checked again before giving the connection to waiter.
   *
   * @param {Number} idx - The index of connection in the pool.
   */
  queueHandler(idx) {
    this.trace(`Redis Connection(pool idx ${idx}) just got released.`);
    this.trace(`queue size: ${this.queue.length}`);

    const conn = this.connections[idx];
    if (conn.free === false && conn.broken === false)
      return;

    if (this.queue.length > 0) {
      conn.free = false;
      this.queue.shift().res(conn);
    }
  }


  /**
   * When there is no free connection in pool, and the pool is not full, create
   * a new connection and put it into the pool.
   */
  async getConnection() {
    const conn = this.connections.find(x => x.free || x.broken);

    if (!conn && this.poolSize < this.config.connectionLimit) {
      this.poolSize += 1;
      return await this.getNewConnection();
    } else {
      return await this.getOldConnection();
    }
  }


  /**
   * Create new PoolConnection object, push it into `this.connections`, then
   * return the PoolConnection object to caller.
   */
  async getNewConnection() {
    this.debug("Trying to get a new Connection.");

    const connIdx = this.connections.length;
    const conn = new PoolConnection(this.config, this, connIdx);

    this.trace("New connection created.");

    if (this.nolog)
      conn.disableLog();

    this.connections.push(conn);
    this.trace("New connection pushed to pool.");

    await conn.initialize();

    return conn;
  }


  /**
   * Get available connection from `this.connections`. There are 2 situations:
   * 1. There are already free connections available, use it directly.
   * 2. No free connection yet, wait for others to release one, then use it.
   *
   * If the connection returned is broken(i.e. the redis server crashes),
   * create a new connection to replace the old one.
   *
   * After getting a connection, the `free` and `broken` flags will be set
   * to fasle immediately.
   */
  async getOldConnection() {
    this.debug("Trying to get a old Connection.");
    var conn = this.connections.find(x => x.free || x.broken);

    if (!conn) {
      this.trace("Waiting for one connection release...");
      conn = await this.waitForRelease();
    }

    this.trace(`Old connection got(pool idx ${conn.idx}).`);

    conn.free = false;
    if (conn.broken) {
      conn.broken = false;
      this.brokenCnt -= 1;
      await conn.repair();
    }

    return conn;
  }


  /**
   * If the Redis server is down, calling waitForRelease will hang forever.
   * Check this situation in a certain period and empty queue when necessary.
   */
  initializeBrokenChecker() {
    setInterval(() =>  this.checkAndEmptyQueue(), 3000);
  }


  /**
   * If there is no live TCP connection, empty the queue.
   */
  checkAndEmptyQueue() {
    this.showConnectionsDetail();
    if (this.noLiveTCPconnection())
      this.emptyQueue();
  }


  /**
   * When poolSize and brokenCnt(the broken TCP connection counter) equals,
   * there is no live TCP connection anymore.
   */
  noLiveTCPconnection() {
    return this.poolSize != 0 && this.poolSize === this.brokenCnt;
  }


  /**
   * Pop the queue and call reject(waitForRelease will get an exception) on
   * all elements.
   */
  emptyQueue() {
    var r;
    while (r = this.queue.shift())
      r.rej(new ConnectionError("No live TCP connection"));
  }


  /**
   * This is why clients can "block" until there are connections available.
   */
  waitForRelease() {
    return new Promise((res, rej) => this.queue.push({ res, rej }));
  }


  /**
   * Show connection active info(is broken or not).
   */
  showConnectionsDetail() {
    this.trace(`B&F: ${this.connections.map(this.formatConnInfo)}`);
    this.trace(`Size&Broken: ${this.poolSize}, ${this.brokenCnt}`);
  }


  formatConnInfo(conn) {
    return `[${conn.broken}:${conn.free}]`;
  }


  /**
   * Disable log and disable log of PoolConnection instances in pool.
   */
  disableLog() {
    super.disableLog();
    this.nolog = true;
    this.connections.forEach(x => x.disableLog());
  }
}




class PoolConnection extends Logger {
  /**
   * PoolConnection Objects always work with RedisConnectionPool Object. It is
   * the object that RedisConnectionPool keeps in the "pool".
   *
   * By using PoolConnection instead of raw connections, client can use
   * `conn.release()` to return connection back to pool.
   */
  constructor(config, pool, idx) {
    super("PoolConnection");
    this.config = config;
    this.pool = pool;
    this.idx = idx;

    this.broken = false;
    this.free = false;
  }


  /**
   * Create new TCP connection to redis server, and initialize some attributes.
   * A PoolConnection object is never destroyed, it not the TCP connection,
   * but a object that holds the TCP connection.
   *
   * The TCP's "end" event should be listened, because when the client wait
   * for connection, it will never receive "error" event.
   */
  async initialize() {
    this.conn = new RedisConnection(this.config);
    this.conn.disableLog();

    this.conn.getRawTCPConnection().on("end", () => {
      this.broken = true;
      this.pool.brokenCnt += 1;
      this.pool.emitter.emit("release", this.idx);
    });

    try {
      await this.conn.initialize();
    } catch (e) {
      this.handleExecuteError(e);
    }
  }


  /**
   * Reset broken flag, and re-initialize the redis connection(create new TCP
   * connection to Redis server).
   */
  async repair() {
    this.warn(`Replacing broken connection(pool idx ${this.idx})...`);
    await this.initialize();
  }


  /**
   * @param {Array} commands - Array like [[ "incr", "a" ], [ "get", "a" ]]
   */
  async transaction(commands) {
    this.debug(`Starting a redis transaction: ${inspect(commands)}`);
    try {
      return await this.conn.transaction(commands);
    } catch (e) {
      this.handleExecuteError(e);
    }
  }


  /**
   * This is the interface for executing redis command.
   * @param {string[]} command - An array like [ "hget", "userxx", "age" ].
   */
  async execute(command) {
    this.debug(`Executing redis command: ${inspect(command)}`);
    try {
      return await this.conn.execute(command);
    } catch (e) {
      this.handleExecuteError(e);
    }
  }


  /**
   * This is the method you should call after you finished your query.
   * There are 2 situations after you call this method:
   * 1. No client is asking for connection yet. In this case, the `free=true`
   *    will make the connection become visible for clients.
   *
   * 2. There are clients waiting for connections. In this case, the `emit`
   *    will give those clients the connection they want.
   */
  release() {
    this.debug(`Releasing connection(pool idx ${this.idx})`);
    this.free = true;
    this.pool.emitter.emit("release", this.idx);
  }


  /**
   * For certain errors like TCP connection error, set `broken` flag to true.
   * The error will be throw again anyway.
   */
  handleExecuteError(e) {
    if (e.constructor === ConnectionError) {
      this.broken = true;
      this.pool.brokenCnt += 1;
    }
    throw e;
  }
}



module.exports = RedisConnectionPool;

