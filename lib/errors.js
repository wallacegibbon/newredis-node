class RedisCommandError extends Error {
  constructor(message) {
    super();
    errorObjInitializer.call(this, "RedisCommandError", message);
  }
}


class ConnectionError extends Error {
  constructor(message) {
    super();
    errorObjInitializer.call(this, "ConnectionError", message);
  }
}


class WaitTimeoutError extends Error {
  constructor(message) {
    super();
    errorObjInitializer.call(this, "WaitTimeoutError", message);
  }
}


function errorObjInitializer(name, message) {
  this.name = name;
  if (message instanceof Error)
    this.message = message.message;
  else
    this.message = message;
}


module.exports = {
  RedisCommandError,
  ConnectionError,
  WaitTimeoutError,
};
