const WebSocket = require('ws');
const Twitter = require('twitter');

const TWITTER_CONSUMER_KEY = 'EnvraFkTwKtXKs5F64fj6KqoG';
const TWITTER_CONSUMER_SECRET = 'gxWoM9qKR3ZRHZGxac18I5JJAglhwZe1kVwgYeSrKvLEoH4aW5';
const TWITTER_ACCESS_TOKEN_KEY = '709412533468327936-oOkRjmfIWAEJVeGI7NypXsjpw2Xz8u6';
const TWITTER_ACCESS_TOKEN_SECRET = 'SGY7Prz1b5ONhXvlVwHFfyw33e9AfvLLRDRmFemaMk1kn';

const TWITTER_TRACK = '#Carlowrie';

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
  var allIds = ["864852544434130944", "864851851296075776", "864851810556813312", "864850962569154560", "864847069344931840", "864846135978057728", "864845046864125952", "864844510618169344", "864844203511164929", "864843220395712514", "864843209196933124", "864843207544373248", "864839099454300161", "864838733081849856", "864838183283982336", "864838055928225795", "864836583010291712", "864836477905141760", "864836149906477056", "864835958679752704", "864825092873875461", "864822278005039108", "864821723845332992", "864819976523436032", "864819882210336768", "864819871527448576", "864819328851595266", "864819199901921280", "864817743140466688", "864813711340556288", "864813440858238976", "864812650810802178", "864812321826275330", "864771797014773760", "789014117063520256", "760820130947469312", "741406750901981185", "729253592394305536", "728498690986528768", "693311719863615489", "610488235148607488", "586820196381364225", "585034493792280576", "573612122778787840", "517647816106455041", "218179057379061760"], idChunks, i;

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
