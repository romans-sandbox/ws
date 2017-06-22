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

/*var a = document.querySelectorAll('.tweet-timestamp.js-permalink'), b = [], i;

for (i = 0; i < a.length; i++) {
  b.push(a[i].href.match(/\d{5,}/)[0]);
}

//b.length;
b.toSource();*/


function updateTweets(ws) {
  var allIds = ["877482654370758656", "877469070672764928", "877190177130770436", "877188883968077824", "877184183562633218", "877176242750889984", "877172727383240704", "877172044240125953", "877168761094250496", "877166402477723653", "877166042665103360", "877164587967279109", "877164402478374912", "877161434484011008", "877160580376915968", "877156402329989120", "877156086943543298", "877155796869668864", "877154536292577280", "877154350099034112", "877143015072116737", "877139033645887489", "877134272225849344", "877131786052128768", "877130748536532992", "877130740173086722", "877127310285078528", "877126887700647936", "877126119971057664", "877125295022669824", "877124060911726592", "877123979856752640", "877123714231488512", "877123390913622017", "877122731216703488", "877122590816514048", "877122355193159680", "877120909387214849", "877120437066616832", "877119414310760449", "877119021157580800", "877118592352964608", "877118191247470598", "877117535015096321", "877116516101181440", "877116044850208768", "877115236519731201", "877114995762491397", "877113548236828672", "877112934207549440", "877105848883052546", "877105783800037377", "877102259577991168", "877101535540523008", "877100691009024000", "877099134444077056", "877099095231483904", "877098567822979072", "877097723022979072", "877096694546149377", "877096203011469313", "877095747421974528", "877095424011718656", "877095329245659136", "877095268604424192", "877094024833896449", "877093575351259137", "877093573035950080", "877093570414620672", "877093394572562433", "877093026014920704", "877092841314553856", "877091508360556544", "877090685186449409", "877089796895772673", "877089390161522688", "877089243390242817", "877089175413063680", "877088715998461956", "877088665922674688", "877087920544505856", "877087466733416448", "877087413360873473", "877087331945197569", "877087090688880640", "877086790829703168", "877086635111976960", "877086458020069376", "877086058537766913", "877085763221024768", "877084722349957121", "877084717023195136", "877084364936491008", "877084221361328129", "877083869455020032", "877083331875274753", "877083195082199040", "877082027312508929", "877081101512171521", "877079300222189568", "877079278751547392", "877076020192522240", "877071312195399680", "877069767596748800", "877068748288663552", "877067710441586688", "877067400138682368", "877054508714651648", "877052913222377472", "877052338623709184", "877051161332899840", "877050315505369089", "876962419708383233", "876922901181739008", "876874592580755456", "876856698471841794", "876777590702444549", "876756461409505281", "876744107691053056", "876741618400940032", "875069159398400001", "874669918289088512", "873195006319882241", "869881014201593857", "849978142890569728", "849917661081423872", "849640750723805184", "746358119400353792", "745639935311511552", "745599141292675072", "745596644050219008", "745522789025611777", "745515233179926529", "745342601528754176", "745308883502120960", "745307751975354368", "745307230061404160", "745287139542339588", "745286519192182784", "745275536189046784"], idChunks, i;

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
