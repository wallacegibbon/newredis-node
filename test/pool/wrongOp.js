const { RedisConnectionPool } = require("../..")


const defaultConfig = {
  connectionLimit: 2,
  password: "asdf",
}


const pool = new RedisConnectionPool(defaultConfig)
//pool.disableLog()


function printTitle(str) {
  console.log(str.padEnd(79, "="))
}



async function delay(milliseconds) {
  return new Promise((res, _) => setTimeout(res, milliseconds))
}


async function testErrOP() {
  while (true) {
    try {
      console.log("Trying to get redis connection from pool".padEnd(78, "."))
      var conn = await pool.getConnection()

      var r = await conn.execute([ "get", "test_string" ])
      console.log("r:", r)

      printTitle("Testing non-exist REDIS command")
      r = await conn.execute([ "aaget", "test_string" ])
      console.log("r:", r)

      conn.release()

    } catch (e) {
      console.log("**Err:", e.message)
    } finally {
      conn.release()
    }

    await delay(2000)
  }

}




(async function() {
  testErrOP()

})().catch(console.error)


