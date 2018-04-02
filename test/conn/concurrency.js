const { RedisConnection } = require("../..")

const conn = new RedisConnection()
// const conn = new RedisConnection({ password: "asdf" })

const arr = []

for (var i = 0; i < 10; i++) {
  arr.push(i)
}

function initializeTeststring() {
  return Promise.all(
    arr.map(i => conn.execute([ "set", "test_string_" + i, i ]))
  )
}

function testConcurrency() {
  return (
    arr.map(i => {
      conn.execute([ "get", "test_string_" + i ])
      .then(
        r => console.log(`R(${i}):`, r),
        e => console.error(`E(${i}):`, e)
      )
    })
  )
}


conn.initialize()
.then(initializeTeststring)
.then(testConcurrency)
.catch(e => console.error("GLOBAL E:", e))


/**
 * To test with fake redis server, you need to call testConcurrency directly.
 * Because initializeTeststring use Promise.all, which will stop when first
 * rej is called.
 */
//conn.initialize().then(testConcurrency)
