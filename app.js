const WebSocket = require('ws');
const Twitter = require('twitter');

const TWITTER_CONSUMER_KEY = 'EnvraFkTwKtXKs5F64fj6KqoG';
const TWITTER_CONSUMER_SECRET = 'gxWoM9qKR3ZRHZGxac18I5JJAglhwZe1kVwgYeSrKvLEoH4aW5';
const TWITTER_ACCESS_TOKEN_KEY = '709412533468327936-oOkRjmfIWAEJVeGI7NypXsjpw2Xz8u6';
const TWITTER_ACCESS_TOKEN_SECRET = 'SGY7Prz1b5ONhXvlVwHFfyw33e9AfvLLRDRmFemaMk1kn';

/*var a = document.querySelectorAll('.tweet-timestamp'); var b = []; for (var i = 0; i < a.length; i++) b.push(a[i].getAttribute('href').match(/\d+$/)[0]); b.toSource();*/

const TWITTER_TRACK = '#ScotSoft2017';

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

/*var a = document.querySelectorAll('.tweet-timestamp.js-permalink'), b = [], i;

for (i = 0; i < a.length; i++) {
  b.push(a[i].href.match(/\d{5,}/)[0]);
}

//b.length;
b.toSource();*/


function updateTweets(ws) {
  var allIds = ["915847070271066113", "915845234038394880", "915844758454587393", "915844745813020672", "915837889531039744", "915836827784876032", "915836456643563525", "915825460642291712", "915818692440723456", "915816886713057280", "915816243311054849", "915809862034051072", "915804121193738241", "915797000574132225", "915614425494769664", "915598834721533953", "915593938026803200", "915581957085519872", "915581274923945984", "915577248098476033", "915573565382168576", "915573534021308417", "915573532951744512", "915526434390773760", "915524457426452480", "915519699366137856", "915510369107496960", "915509842609045504", "915509659376717824", "915491714198056966", "915188292248915969", "915177248990392320", "915177214655827968", "915177201372483589", "915169068453388288", "915149564956561408", "915147044427354112", "915134363758718976", "915134346880851969", "915134346587144192"], idChunks, i;

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
