const RedisParser = require("redis-parser");
const net = require("net");
const { inspect } = require("util");
const { Logger } = require("colourlogger");

const { ConnectionError } = require("./errors");


class RedisConnection extends Logger {
  /**
   * This Class will create a connection to Redis server, and use redis-parser
   * to parse data the server sent back. It is Promise-based, user do not need
   * to handle any event, or pass any callback to `execute` method.
   *
   * It's highly recommended to use this class with ES8's async function.
   *
   * @param {Object} config - Object like { port: 6379, host: "localhost" }.
   */
  constructor(config) {
    super("RedisConnection");
    this.config = Object.assign({ port: 6379, host: "localhost" }, config);
    this.queue = [];

    this.initializeParser();
    this.initializeConnection();
  }


  /**
   * Create a TCP connection to the target Redis server. Data come from this
   * connection will be sent to parser.
   */
  initializeConnection() {
    this.connection = net.createConnection(this.config);

    this.connection.on("data", d => this.parser.execute(d));

    this.connection.on("error", e => {
      this.queueHandlerError(new ConnectionError(e.message));
    });
  }


  /**
   * FatalError means the protocol error, which means the redis server went
   * crazy. The `redis-parser` document suggests to close the TCP connection
   * when FatalError is triggered.
   */
  initializeParser() {
    this.parser = new RedisParser({
      returnFatalError: this.queueHandlerFatal.bind(this),
      returnError: this.queueHandlerError.bind(this),
      returnReply: this.queueHandlerData.bind(this),
    });
  }


  /**
   * TCP connection should be closed, and all command waiters in the queue
   * will be rejected.
   */
  queueHandlerFatal(e) {
    this.error("A fatal error is raised, will close the TCP connection.");
    this.trace(`${this.queue.length} waiters in queue will be flushed`);

    this.connection.destroy();

    while (this.queue.length > 0)
      this.queue.shift().rej(e);
  }


  /**
   * If the queue is not empty, get the oldest one and give error back to it.
   */
  queueHandlerError(e) {
    this.trace(`Current function queue size: ${this.queue.length}`);
    this.trace(`Calling queueHandlerError with: ${e}`);

    if (this.queue.length > 0)
      this.queue.shift().rej(e);
  }


  /**
   * If the queue is not empty, get the oldest one and give data back to it.
   */
  queueHandlerData(d) {
    this.trace(`Current function queue size: ${this.queue.length}`);
    this.trace(`Calling queueHandlerData with: ${d}`);

    if (this.queue.length > 0)
      this.queue.shift().res(d);
  }


  /**
   * This is just a wrapper for this.executeCmd, but will try to auth when
   * executeCmd failed.
   *
   * @param {string[]} commandArr - Array like [ "set", "name", "wallace" ]
   */
  async execute(commandArr) {
    this.debug(`Executing redis command: ${inspect(commandArr)}`);
    await this.initializeDbNum();
    return await this.executeWithAuth(commandArr);
  }


  /**
   * If dbNum exists in configuration file, initialize it at start up.
   */
  async initializeDbNum() {
    if (this.config.dbNum && !this.dbNumInitialized) {
      await this.executeWithAuth([ "select", this.config.dbNum ]);
      this.dbNumInitialized = true;
    }
  }


  /**
   * Execute a command, if failed, check error type. When it's NOAUTH error,
   * try to do auth and then send the command again.
   */
  async executeWithAuth(commandArr) {
    try {
      return await this.executeCmd(commandArr);
    } catch (e) {
      return this.handleExecuteError(e, commandArr);
    }
  }


  /**
   * The resolve and reject function of the returned promise will be pushed
   * to queue before sending command to redis server.
   *
   * This is the most fundamental method to do Redis query.
   * @param {string[]} commandArr
   */
  executeCmd(commandArr) {
    const cmd = encodeRedisCommand(commandArr);
    this.trace(`Raw redis command: ${JSON.stringify(cmd.toString())}`);

    return new Promise((res, rej) => {
      this.queue.push({ res, rej });
      this.connection.write(cmd);
    });
  }


  /**
   * NOAUTH exception will be handled, other errors will be simply throw out.
   *
   * If password is configured, send auth command, then the query command.
   * Return the result that redis server returns.
   *
   * @param {Error} e
   * @param {string[]} commandArr
   */
  async handleExecuteError(e, commandArr) {
    if (e.message.indexOf("NOAUTH") === -1)
      throw e;

    if (!this.config.password)
      throw new Error("Redis password needed");

    await this.executeCmd([ "auth", this.config.password ]);
    return await this.executeCmd(commandArr);
  }


  /**
   * Other programs may need to handle some events of the raw TCP connection.
   */
  getRawTCPConnection() {
    return this.connection;
  }
}



/**
 * The command you send to redis server will always be array element (the "*").
 *
 * @param {string[]} commands - Array like [ "set", "name", "wallace" ]
 * @returns {string} - String like "*3\r\n$3\r\nset\r\n..."
 */
function encodeRedisCommand(commands) {
  if (!commands || !Array.isArray(commands) || commands.length === 0)
    throw new Error(`Invalid redis command: ${commands}`);

  const topInfo = Buffer.from(`*${commands.length}\r\n`);
  const parts = commands.map(adjustCommandArgument)
                  .map(x => Buffer.from(`\$${x.length}\r\n${x}\r\n`));

  parts.unshift(topInfo);
  return Buffer.concat(parts);
}


/**
 * Only string and number are valid redis argument, other type of data will be
 * treated as error.
 */
function adjustCommandArgument(argObj) {
  if (typeof argObj === "number") {
    return argObj.toString();

  } else if (typeof argObj === "string") {
    return argObj;

  } else if (!argObj) {
    return "";

  } else {
    throw new Error(`Invalid redis command argument: ${inspect(argObj)}`);
  }
}


module.exports = RedisConnection;

