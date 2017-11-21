const RedisParser = require("redis-parser");
const net = require("net");
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
   * Initialize the parser. Error and FatalError are different situations.
   */
  initializeParser() {
    this.parser = new RedisParser({
      returnFatalError: this.queueHandlerFatal.bind(this),
      returnError: this.queueHandlerError.bind(this),
      returnReply: this.queueHandlerData.bind(this),
    });
  }


  /**
   * Fatal error means protocol error. TCP connection should be closed, and
   * all command waiters in the queue should be rejected.
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
    this.debug(`Trying to execute redis command: ${commandArr}`);
    try {
      return await this.executeCmd(commandArr);
    } catch (e) {
      return this.handleExecuteError(e, commandArr);
    }
  }


  /**
   * This is the most fundamental method to do Redis query.
   * @param {string[]} commandArr
   */
  executeCmd(commandArr) {
    this.trace(`Sending redis command: ${commandArr}`);
    return new Promise((res, rej) => {
      this.queue.push({ res, rej });
      this.connection.write(encodeRedisCommand(commandArr));
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
  const result = [ Buffer.from(`*${commands.length}\r\n`) ];
  var size = result[0].length;

  for (var x of commands) {
    x = x.toString();
    var argBuf = Buffer.from(`\$${x.length}\r\n${x}\r\n`);

    size += argBuf.length;
    result.push(argBuf);
  }

  return Buffer.concat(result, size);
}


module.exports = RedisConnection;

