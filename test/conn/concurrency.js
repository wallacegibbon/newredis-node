const { RedisConnection } = require("../..");

const conn = new RedisConnection({ password: "asdf" });

const arr = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ];

function initializeTeststring() {
  return Promise.all(
    arr.map(i => conn.execute([ "set", "test_string_" + i, i ]))
  );
}

function testConcurrency() {
  return Promise.all(
    arr.map(i => {
      conn.execute([ "get", "test_string_" + i ])
      .then(
        r => console.log(`R(${i}):`, r),
        e => console.error("Err:", e)
      );
    })
  );
}


initializeTeststring().then(testConcurrency);

