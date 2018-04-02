const { RedisConnection } = require("../..")


async function test() {
  try {
    console.log("Trying to create connection to redis server...")
    const conn = new RedisConnection({ password: "asdf" })

    await conn.initialize()

    console.log("==Trying to get a string key who doesn't exists...")
    var r = await conn.execute([ "get", "blahblah" ])
    console.log("r:", r)

    console.log("==Trying to get a hash key who doesn't exists...")
    r = await conn.execute([ "hmget", "blahblah", "a", "b" ])
    console.log("r:", r)

  } catch (e) {
    console.error("**Err:", e)
  }
}


(async function() {
  await test()

})().catch(console.error)

