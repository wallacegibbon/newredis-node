const RedisParser = require("redis-parser")
const net = require("net")
const { inspect } = require("util")
const { Logger } = require("colourlogger")

const { selectFields } = require("./utils")
const { RedisTransactionError, RedisCommandError, ConnectionError }
  = require("./errors")



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
    super("RedisConnection")
    const cfg = selectFields(config, [ "port", "host", "password", "dbNum" ])
    this.config = Object.assign({ port: 6379, host: "127.0.0.1" }, cfg)
    this.queue = []

    this.initializeParser()
    this.initializeConnection()
  }


  /**
   * Create a TCP connection to the target Redis server. Data come from this
   * connection will be sent to parser.
   */
  initializeConnection() {
    this.connection = net.createConnection(this.config)

    this.connection.on("data", d => this.parser.execute(d))

    this.connection.on("error", e => {
      this.queueHandlerError(new ConnectionError(e.message))
    })
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
    })
  }


  /**
   * TCP connection should be closed, and all command waiters in the queue
   * will be rejected.
   */
  queueHandlerFatal(e) {
    this.error("A fatal error has raised, will close the TCP connection.")
    this.trace(`${this.queue.length} waiters in queue will be flushed`)
    this.connection.destroy()

    while (this.queue.length > 0) {
      this.queue.shift().rej(e)
    }
  }


  /**
   * If the queue is not empty, get the oldest one and give error back to it.
   */
  queueHandlerError(e) {
    this.trace(`Current result waiter queue size: ${this.queue.length}`)
    if (this.queue.length > 0) {
      this.queue.shift().rej(e)
    }
  }


  /**
   * If the queue is not empty, get the oldest one and give data back to it.
   */
  queueHandlerData(d) {
    this.trace(`Current result waiter queue size: ${this.queue.length}`)
    if (this.queue.length > 0) {
      this.queue.shift().res(d)
    }
  }


  /**
   * If you need to set password or select non-default db, call this method.
   */
  async initialize() {
    if (this.config.password) {
      await this.execute([ "auth", this.config.password ])
    }
    await this.backToDefaultDb()
  }


  /**
   * Change back to default db.
   */
  async backToDefaultDb() {
    this.debug(`Switching back to default db (${this.config.dbNum})`)
    if (this.config.dbNum) {
      await this.execute([ "select", this.config.dbNum ])
    }
  }


  /**
   * This is just a wrapper for this.executeCmd with argument check.
   * @param {string[]} command - Array like [ "set", "name", "wallace" ]
   */
  async execute(command) {
    this.debug(`Executing a redis command: ${inspect(command)}`)
    if (command && Array.isArray(command) && command.length > 0) {
      return await this.executeCmd(encodeCommand(command))
    } else {
      throw new RedisCommandError(inspect(command))
    }
  }


  /**
   * This is the most fundamental method to do Redis query.
   * @param {string[]} command
   */
  executeCmd(command) {
    this.trace(`Raw command: ${JSON.stringify(command.toString())}`)
    return new Promise((res, rej) => {
      this.queue.push({ res, rej })
      this.connection.write(command)
    })
  }


  /**
   * Other programs(like the RedisConnectionPool) need to handle TCP end.
   */
  bindEndEvent(fn) {
    this.connection.on("end", fn)
  }


  /**
   * Other programs may need to handle events of the raw TCP connection.
   */
  getRawTCPConnection() {
    return this.connection
  }
}



/**
 * Commands you send to redis server will always be array element (the "*").
 *
 * @param {string[]} command - Array like [ "set", "name", "wallace" ]
 * @returns {string} - String like "*3\r\n$3\r\nset\r\n..."
 */
function encodeCommand(command) {
  const topInfo = Buffer.from(`*${command.length}\r\n`)
  const parts = command.map(adjustCommandArgument)
                  .map(x => Buffer.from(`\$${x.length}\r\n${x}\r\n`))

  parts.unshift(topInfo)
  return Buffer.concat(parts)
}


/**
 * Only strings and numbers are valid redis arguments, other type of data
 * will be treated as error.
 */
function adjustCommandArgument(argObj) {
  if (typeof argObj === "number") {
    return argObj.toString()
  } else if (typeof argObj === "string") {
    return argObj
  } else if (!argObj) {
    return ""
  } else {
    throw new RedisCommandError(`Argument: ${inspect(argObj)}`)
  }
}


module.exports = RedisConnection

