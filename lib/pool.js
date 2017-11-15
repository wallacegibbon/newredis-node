const { Logger } = require("colourlogger");
const EventEmitter = require("events");
const util = require("util");

const RedisConnection = require("./conn");
const { ConnectionError } = require("./error");


class RedisPoolEventEmitter extends EventEmitter {}


class RedisConnectionPool extends Logger {
  /**
   * Attribute `this.connections` is the "pool", it holds all redis connections.
   * And `this.emitter` give clients the ability to *wait* for connections.
   */
  constructor(config) {
    super("RedisConnectionPool");
    this.config = Object.assign({ connectionLimit: 10, port: 6379 }, config);

    this.connections = [];
    this.queue = [];

    //Sometimes, you can't use `this.connections.length` because of
    //concurrency problem.
    this.poolSize = 0;

    const emitter = new RedisPoolEventEmitter();
    emitter.on("release", this.queueHandler.bind(this));

    this.emitter = emitter;

    this.nolog = false;
  }


  /**
   * As this function is executed asynchronously, the `free` flag should be
   * checked again before giving the connection to waiter.
   *
   * @param {Number} idx - The index of connection in the pool.
   */
  queueHandler(idx) {
    this.trace(`Redis Connection(pool idx ${idx}) just got released.`);
    this.debug(`queue size: ${this.queue.length}`);

    const conn = this.connections[idx];
    if (conn.free === false && conn.broken === false)
      return;

    if (this.queue.length > 0) {
      conn.free = false;
      this.queue.shift()(conn);
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
    this.trace("Trying to get a new Connection.");
    const connIdx = this.connections.length;
    const conn = new PoolConnection(this.config, this, connIdx);

    if (this.nolog)
      conn.disableLog();

    this.connections.push(conn);

    await conn.initialize();

    this.trace("New connection created and pushed to pool.");
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
    this.trace("Trying to get a old Connection.");
    var conn = this.connections.find(x => x.free || x.broken);
    if (!conn) {
      this.trace("Waiting for one connection release...");
      conn = await this.waitForRelease();
    }

    this.trace(`Old connection got(pool idx ${conn.idx}).`);

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
    return new Promise((res, _) => this.queue.push(res));
  }


  /**
   * Disable log of this object and PoolConnection instances inside this obj.
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
    const conn = new RedisConnection(this.config);
    conn.disableLog();

    conn.connection.on("end", () => {
      this.broken = true;
      this.pool.emitter.emit("release", this.idx);
    });

    this.conn = conn;
  }


  /**
   * Reset broken flag, and re-initialize the redis connection(create new TCP
   * connection to Redis server).
   */
  async repair() {
    this.debug("Try to replace broken connection with a new one.");
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
    this.trace(`Trying to release connection(pool idx ${this.idx})`);
    this.free = true;
    this.pool.emitter.emit("release", this.idx);
  }
}



module.exports = RedisConnectionPool;

