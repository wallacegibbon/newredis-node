const RedisConnection = require("../../lib/conn");

const conn = new RedisConnection();

const arr = [ 1, 2, 3, 4, 5, 6, 7, 8, 9 ];

function initializeTeststring() {
  return Promise.all(
    arr.map(i => {
      return conn.execute([ "auth", "asdf" ])
      .then(() => {
        console.log(`${i} initialize...`);
        return conn.execute([ "set", "test_string_" + i, i ]);
      })
      .catch(e => {
        console.error("Err:", e);
      });
    })
  );
}

function testConcurrency() {
  return Promise.all(
    arr.map(i => {
      conn.execute([ "auth", "asdf" ])
      .then(() => {
        console.log(`${i} executing...`);
        return conn.execute([ "get", "test_string_" + i ]);
      })
      .then(r => {
        console.log(`R(${i}):`, r)
      })
      .catch(e => {
        console.error("Err:", e);
      });
    })
  );
}


initializeTeststring().then(testConcurrency);

