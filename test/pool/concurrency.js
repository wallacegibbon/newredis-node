const { RedisConnectionPool } = require("../..");


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
};


const pool = new RedisConnectionPool(defaultConfig);
//pool.disableLog();



function testConcurrency() {
  for (var i = 0; i < 10; i++) {
    pool.getConnection()
    .then(conn => {

      const a = () =>
        conn.execute([ "get", "test_string" ]).then(r => console.log("R:", r));

      const b = () => 
        conn.release();

      return a().then(b);
    })
    .catch(e => {
      console.error("Err:", e);
    });
  }
}


testConcurrency();
