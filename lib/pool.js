const { createConnection, execute } = require("../lib/basic");
const EventEmitter = require("events");
const util = require("util");


class RedisPoolEventEmitter extends EventEmitter {}



class RedisPool {
  /**
   * The most important part of this class is `connections` and `emitter`. The
   * `connections` is the array that holds all connections. And `emitter` is
   * what give clients the ability to *wait* for connections.
   */
  constructor(config) {
    this.emitter = new RedisPoolEventEmitter();
    this.connections = [];

    this.config = config;
  }


  /**
   * When the connection list is not full, create new connection even if there
   * are free connections available.
   */
  async getConnection() {
    if (this.connections.length < this.config.connectionLimit)
      return await this.getNewConnection();
    else
      return await this.getOldConnection();
  }


  /**
   * Create new PoolConnection object, push it into `this.connections`, then
   * return the PoolConnection object to caller.
   */
  async getNewConnection() {
    const connIdx = this.connections.length;
    const conn = new PoolConnection(this.config, this, connIdx);
    await conn.initialize();

    this.connections.push(conn);
    conn.free = false;

    return conn;
  }


  /**
   * Get available connection from `this.connections`. There are 2 situations:
   * 1. There are already free connections to use, use it directly.
   * 2. No free connection yet, wait for others to release one, then use it.
   *
   * If the connection returned is broken(i.e. the redis server crashes),
   * create a new connection to replace the old one.
   */
  async getOldConnection() {
    var conn = this.connections.find(x => x.free || x.broken);
    if (!conn)
      conn = await this.waitForRelease();

    if (conn.broken)
      await conn.repair();

    conn.free = false;

    return conn;
  }


  /**
   * This is why clients can wait for connection to become available.
   */
  waitForRelease() {
    return new Promise((res, _) => {
      this.emitter.once("release", idx => res(this.connections[idx]));
    });
  }


  /**
   * Just for test
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
   * PoolConnection is always work with RedisPool Object. It is the object that
   * RedisPool keeps in the "pool". By using PoolConnection instead of raw
   * connections, client can use `conn.release()` to return connection back to
   * pool. Which is more convenient.
   */
  constructor(config, pool, idx) {
    this.config = config;
    this.pool = pool;
    this.idx = idx;
  }


  /**
   * Create new TCP connection to redis server, and initialize some attributes.
   * This method may got called directly or by `repair`.
   */
  async initialize() {
    this.conn = await createConnection(this.config.port, this.config.host);
    this.free = true;
    this.broken = false;
  }


  /**
   * Just a wrapper for initialize with some log. This method is called from
   * outside, usually from the RedisPool methods.
   */
  async repair() {
    console.log("**The old redis connection is broken, creating a new one");
    await this.initialize();
  }


  /**
   * This is the method you should call after you finished your query. There
   * are 2 situations, too:
   * 1. No client is asking for connection yet. In this case, the `free=true`
   *    will make the connection become visible for clients.
   * 2. There are clients waiting for connections. In this case, the `emit`
   *    will give those client the connection they want.
   */
  release() {
    this.free = true;
    this.pool.emitter.emit("release", this.idx);
  }


  /**
   * This is the most fundamental query method, command is an array of redis
   * commands like [ "hmget", "userxx", "name", "age" ].
   */
  async execute(command) {
    try {
      return await execute(this.conn, command);
    } catch (e) {
      console.error("PoolConnection execute error:", e);
      this.broken = true;
    }
  }
}


module.exports = RedisPool;

