/**
 * Connection Error should be seperated from Redis Error. As connection error
 * will need you to re-establish the connection.
 */
class ConnectionError extends Error {
  constructor(message) {
    super();
    errorObjInitializer.call(this, "ConnectionError", message);
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
  ConnectionError,
};
