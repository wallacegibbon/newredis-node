const RedisConnection = require("./conn");
const util = require("util");
const logger = require("lvlog").getLogger("redispool");

const { RedisPoolEventEmitter } = require("./emitter");
const { ConnectionError } = require("./error");



class RedisPool {
  /**
   * Attribute `this.connections` is the "pool", it holds all redis connections.
   * And `this.emitter` give clients the ability to *wait* for connections.
   */
  constructor(config) {
    this.config = Object.assign({ connectionLimit: 10, port: 6379 }, config);

    this.connections = [];
    this.waitQueue = [];

    //Sometimes, you can't use `this.connections.length` because of
    //concurrency problem.
    this.poolSize = 0;

    const emitter = new RedisPoolEventEmitter();
    emitter.on("release", this.waitQueueHandler.bind(this));

    this.emitter = emitter;
  }


  /**
   * As this function is executed asynchronously, the `free` flag should be
   * checked again before giving the connection to waiter.
   *
   * @param {Number} idx - The index of connection in the pool.
   */
  waitQueueHandler(idx) {
    logger.trace(`Redis Connection(pool idx ${idx}) released.`);
    logger.debug(`waitQueue size: ${this.waitQueue.length}`);

    const conn = this.connections[idx];
    if (conn.free === false && conn.broken === false)
      return;

    const fn = this.waitQueue.shift();
    if (fn) {
      conn.free = false;
      fn(conn);
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
    logger.trace("Trying to get a new Connection.");
    const connIdx = this.connections.length;
    const conn = new PoolConnection(this.config, this, connIdx);

    this.connections.push(conn);

    await conn.initialize();

    logger.trace("New connection created and pushed to pool.");
    return conn;
  }


  /**
   * Get available connection from `this.connections`. There are 2 situations:
   * 1. There are already free connections available, use it directly.
   * 2. No free connection yet, wait for others to release one, then use it.
   *
   * If the connection returned is broken(i.e. the redis server crashes),
   * create a new connection to replace the old one.
   */
  async getOldConnection() {
    logger.trace("Trying to get a old Connection.");
    var conn = this.connections.find(x => x.free || x.broken);
    if (!conn) {
      logger.trace("Waiting for one connection release...");
      conn = await this.waitForRelease();
    }

    logger.trace(`Old connection got(pool idx ${conn.idx}).`);

    //After getting a connection, set both it's `free` and `broken`
    //to false immediately.
    conn.free = false;

    if (conn.broken) {
      conn.broken = false;
      await conn.repair();
    }

    return conn;
  }


  /**
   * This is why clients can "block" until there are connections available.
   */
  waitForRelease() {
    return new Promise((res, _) => this.waitQueue.push(res));
  }


  /**
   * The package user will need to stop the log output.
   */
  disableLog() {
    logger.setLevel("ERROR");
  }


  /**
   * Just some functions for test
   */
  showConnections() {
    return util.inspect(this.connections.map(x => [ x.broken, x.free ]));
  }
}




class PoolConnection {
  /**
   * PoolConnection Objects always work with RedisPool Object. It is the object
   * that RedisPool keeps in the "pool".
   *
   * By using PoolConnection instead of raw connections, client can use
   * `conn.release()` to return connection back to pool.
   */
  constructor(config, pool, idx) {
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
   */
  async initialize() {
    const conn = new RedisConnection(this.config);

    //Redis server will not close a client connection in normal case.
    conn.connection.on("end", () => {
      this.broken = true;
      this.pool.emitter.emit("release", this.idx);
    });

    this.conn = conn;

    if (this.config.password) {
      await this.execute([ "auth", this.config.password ]);
    }
  }


  /**
   * Reset broken flag, and re-initialize the redis connection(create new TCP
   * connection to Redis server).
   */
  async repair() {
    logger.debug("Try to drop broken connection and create a new one.");
    await this.initialize();
  }


  /**
   * This is the interface for executing redis command.
   * @param {string[]} command - An array like [ "hget", "userxx", "age" ].
   */
  async execute(command) {
    try {
      return await this.conn.execute(command);
    } catch (e) {
      if (e.constructor === ConnectionError)
        this.broken = true;
      throw e;
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
    logger.trace(`Trying to release connection(pool idx ${this.idx})`);
    this.free = true;
    this.pool.emitter.emit("release", this.idx);
  }
}



module.exports = RedisPool;

