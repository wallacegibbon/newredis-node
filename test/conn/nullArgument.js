const { RedisConnection } = require("../..")
const { inspect } = require("util")


async function test() {
  try {
    console.log("Trying to create connection to redis server...")
    const conn = new RedisConnection({ password: "asdf" })

    await conn.initialize()

    console.log("Setting key test_string to null...")
    await conn.execute([ "set", "test_string", null  ])

    console.log("Getting key test_string.")
    const r = await conn.execute([ "get", "test_string" ])
    console.log("R:", inspect(r))

  } catch (e) {
    console.error("**Err:", e)
  }
}



(async function() {
  await test()

})().catch(console.error)

