const RedisConnection = require("./conn");
const util = require("util");

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

    this.emitter = new RedisPoolEventEmitter();

    this.emitter.on("release", idx => {
      const waiter = this.waitQueue.shift();
      if (waiter)
        waiter(this.connections[idx]);
    });
  }


  /**
   * When there is no free connection in pool, and the pool is not full, create
   * a new connection and put it into the pool.
   */
  async getConnection() {
    var conn = this.connections.find(x => x.free || x.broken);

    if (!conn && this.connections.length < this.config.connectionLimit)
      return await this.getNewConnection();
    else
      return await this.getOldConnection(conn);
  }


  /**
   * Create new PoolConnection object, push it into `this.connections`, then
   * return the PoolConnection object to caller.
   */
  async getNewConnection() {
    const connIdx = this.connections.length;
    const conn = new PoolConnection(this.config, this, connIdx);

    //Have to push conn to pool before calling it's `initialize` method, or
    //the pool size may be bigger than connectionLimit.
    //Because conn.initialize is async.
    this.connections.push(conn);

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
   */
  async getOldConnection(conn) {
    if (!conn)
      conn = await this.waitForRelease();

    conn.free = false;

    if (conn.broken)
      await conn.repair();

    return conn;
  }


  /**
   * This is why clients can "block" to wait for connection to be available.
   */
  waitForRelease() {
    return new Promise((res, _) => this.waitQueue.push(res));
  }


  /**
   * Just some functions for test
   */
  showConnections() {
    return util.inspect(this.connections.map(this.getFreeAndBrokenField));
  }


  getFreeAndBrokenField(conn) {
    return { broken: conn.broken, free: conn.broken };
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
   * A PoolConnection object is never destroyed, it not the TCP connection, but
   * a object that holds the TCP connection.
   */
  async initialize() {
    this.conn = new RedisConnection(this.config);
    await this.conn.auth();

    this.broken = false;
    this.free = false;
  }


  /**
   * Just a wrapper for initialize with some log. This is useful when you want
   * to know whether old connection is abandoned.
   */
  async repair() {
    //console.log("**Try to drop broken connection and create a new one.");
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
    this.free = true;
    this.pool.emitter.emit("release", this.idx);
  }
}



module.exports = RedisPool;

