class ConnectionError extends Error {
  /**
   * Connection Error should be seperated from Redis Error. As connection error
   * will need you to re-establish the connection.
   */
  constructor(msg) {
    super();
    this.name = "ConnectionError";
    this.message = msg;
  }
}


module.exports = {
  ConnectionError,
};