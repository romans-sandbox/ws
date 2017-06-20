const WebSocket = require('ws');
const Twitter = require('twitter');

const TWITTER_CONSUMER_KEY = 'EnvraFkTwKtXKs5F64fj6KqoG';
const TWITTER_CONSUMER_SECRET = 'gxWoM9qKR3ZRHZGxac18I5JJAglhwZe1kVwgYeSrKvLEoH4aW5';
const TWITTER_ACCESS_TOKEN_KEY = '709412533468327936-oOkRjmfIWAEJVeGI7NypXsjpw2Xz8u6';
const TWITTER_ACCESS_TOKEN_SECRET = 'SGY7Prz1b5ONhXvlVwHFfyw33e9AfvLLRDRmFemaMk1kn';

const TWITTER_TRACK = '#scotcloud';

const wss = new WebSocket.Server({
  port: process.env.PORT || 8081
});

wss.broadcast = function (data) {
  wss.clients.forEach(function (client) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify(data));
    }
  });
};

var stream = null;
var latestTweets = null;
var allTweets = [];
var requestLatestTweets = false;

var twitterClient = new Twitter({
  consumer_key: TWITTER_CONSUMER_KEY,
  consumer_secret: TWITTER_CONSUMER_SECRET,
  access_token_key: TWITTER_ACCESS_TOKEN_KEY,
  access_token_secret: TWITTER_ACCESS_TOKEN_SECRET
});

function emitAllTweets(ws) {
  var top50;

  top50 = allTweets.slice(0, 100);

  wss.broadcast(['all tweets', top50]);
}

function optimiseTweet(tweet) {
  var opt = {
    id: tweet.id_str,
    value: tweet.score,
    image: tweet.user.profile_image_url_https.replace('_normal', ''), // original size
    text: tweet.text,
    user_name: tweet.user.name,
    screen_name: tweet.user.screen_name,
    media_url: tweet.entities && tweet.entities.media && tweet.entities.media.length ? tweet.entities.media[0].media_url_https : null,
    favorite_count: tweet.favorite_count,
    retweet_count: tweet.retweet_count
  };

  if (tweet.entities && tweet.entities.media && tweet.entities.media.length) {
    opt.media_url = tweet.entities.media[0].media_url_https;
  }

  return opt;
}

function norTweets() {
  var i;

  for (i = 0; i < allTweets.length; i++) {
      allTweets[i].value = allTweets[i].favorite_count + allTweets[i].retweet_count + 1;
  }

  allTweets.sort(function(a, b) {
    if (a.value == b.value) {
      return a.id > b.id ? 1 : -1;
    }

    return a.value < b.value ? 1 : -1;
  });

  for (i = 0; i < allTweets.length; i++) {
    allTweets[i].number = i + 1;
  }
}

function addTweet(ws, tweet, update) {
  var exists = false, existsIndex = null, i;

  if (!tweet.in_reply_to_status_id && !tweet.retweeted_status) {
    for (i = 0; i < allTweets.length; i++) {
      if (allTweets[i].id === tweet.id_str) {
        exists = true;
        existsIndex = i;
        break;
      }
    }

    if (exists && update || !exists) {
      if (existsIndex !== null) {
        allTweets[existsIndex] = optimiseTweet(tweet);
      } else {
        allTweets.push(optimiseTweet(tweet));
      }

      norTweets();

      if (ws) {
        emitAllTweets(ws);
      }

      return true;
    }
  }

  return false;
}

function removeTweet(ws, tweetId) {
  var i;

  for (i = 0; i < allTweets.length; i++) {
    if (allTweets[i].id === tweetId) {
      allTweets.splice(i, 1);
    }
  }

  norTweets();

  if (ws) {
    emitAllTweets(ws);
  }
}

function chunk(arr, len) {
  var chunks = [],
    i = 0,
    n = arr.length;

  while (i < n) {
    chunks.push(arr.slice(i, i += len));
  }

  return chunks;
}

function updateTweets(ws) {
  var allIds = ["877083331875274753", "877083195082199040", "877082027312508929", "877081101512171521", "877079300222189568", "877079278751547392", "877076020192522240", "877071312195399680", "877069767596748800", "877067710441586688", "877067400138682368", "877054508714651648", "877052913222377472", "877052338623709184", "877051161332899840", "877050315505369089", "876962419708383233", "876922901181739008", "876874592580755456", "876856698471841794", "876777590702444549", "876756461409505281", "876744107691053056", "876741618400940032", "875069159398400001", "874669918289088512", "873195006319882241", "869881014201593857", "849978142890569728"], idChunks, i;

  for (i = 0; i < allTweets.length; i++) {
    allIds.push(allTweets[i].id);
  }

  idChunks = chunk(allIds, 100);

  if (idChunks.length) {
    for (i = 0; i < idChunks.length; i++) {
      (function(ids, i) {
        setTimeout(function() {
          console.log('Requesting tweet updates (' + (i * 100 + 1) + ' to ' + Math.min(allIds.length, i * 100 + 100) + ' of ' + allIds.length + ')...');

          twitterClient.post(
            'statuses/lookup',
            {
              id: ids.join(','),
              map: true,
              include_entities: true
            },
            function(error, data, response) {
              var k;

              if (data && 'id' in data) {
                console.log('Tweet updates received.');

                for (k in data.id) {
                  if (data.id.hasOwnProperty(k)) {
                    if (data.id[k] !== null) {
                      // probably updated
                      addTweet(ws, data.id[k], true);
                    } else {
                      // deleted or unavailable
                      removeTweet(ws, k);
                    }
                  }
                }
              } else {
                console.log(error);
                console.log('! Empty response when requesting tweet updates.');
              }
            }
          );
        }, i * 20 * 1000);
      })(idChunks[i], i);
    }

    setTimeout(function() {
      updateTweets(ws);
    }, idChunks.length * 20 * 1000);
  }
}

wss.on("connection", function(ws) {
  if (stream === null) {
    console.log('Initiating streaming...');
    twitterClient.stream("statuses/filter", {
      track: TWITTER_TRACK
    }, function(s) {
      console.log('Streaming initiated.');

      stream = s;
      stream.on("data", function(tweet) {
        if (addTweet(ws, tweet)) {
          console.log('New tweet!');

          wss.broadcast(["new tweet", optimiseTweet(tweet)]);
        }
      });
      stream.on('error', function(error) {
        console.log('! Streaming error.', error);
      });

      if (requestLatestTweets) {
        console.log('Requesting previously posted tweets...');
        twitterClient.get('search/tweets', {
          q: track,
          result_type: 'recent',
          include_entities: true
        }, function(error, tweets, response) {
          var i;

          if (tweets && !error) {
            console.log('Previously posted tweets received.');

            latestTweets = tweets;

            for (i = 0; i < tweets.statuses.length; i++) {
              addTweet(ws, tweets.statuses[i]);
            }

            console.log('Previously posted tweets emitted.');

            wss.broadcast(['latest tweets', tweets]);
          } else if (!tweets) {
            console.log('! No previously posted tweets found.');
          } else {
            console.log('! Could not retrieve previously posted tweets.');
          }
        });
      }

      setTimeout(function() {
        updateTweets(ws);
      }, 20 * 1000);

      console.log('Update tweets timer registered.');
    });
  } else {
    emitAllTweets(ws);
  }
});
