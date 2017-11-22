const { RedisConnectionPool } = require("../..");


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
};


const pool = new RedisConnectionPool(defaultConfig);
//pool.disableLog();



async function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds));
}


async function testServerError() {
  while (true) {
    try {
      console.log("Trying to get redis connection from pool".padEnd(78, "."));
      var conn = await pool.getConnection();

      var r = await conn.execute([ "get", "test_string" ]);
      console.log("r:", r);

    } catch (e) {
      console.error("**Err:", e);
    } finally {
      //conn.release();
    }

    await delay(2000);
  }
}


(async function() {
  testServerError();

})().catch(console.error);


