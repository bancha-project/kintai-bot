const SLACK_ACCESS_TOKEN = PropertiesService.getScriptProperties().getProperty('SLACK_ACCESS_TOKEN');
const SLACK_VERIFICATION_TOKEN = PropertiesService.getScriptProperties().getProperty('SLACK_VERIFICATION_TOKEN');
const SLACK_CHANNEL = PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL'); // チャンネルIDを登録
const SPREADSHEET_ID = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); // SpreadsheetIDを登録

const SUMMARY_MODE = 0;
const REGISTER_MODE = 1;

// webアプリはdoPostじゃないとダメ
function doPost(e) {  
  const json = JSON.parse(e.postData.getDataAsString());
  
  if (isInvalidToken(json.token)) {
    return;
  }

  if (isInvalidChannel(json.event.channel)) {
    return;
  }
  
  const user = json.event.user;
  const text = json.event.text.slice(13).trimStart(); // メンション部分を消してトリム

  switch(mode(user, text)) {
    case SUMMARY_MODE:
      summary();
      break;
    default:
      write(user, text);
      if (user == 'UM1L1N9BM') {
        react(json.event.event_ts, 'anger');
        var slackApp = SlackApp.create(SLACK_ACCESS_TOKEN);
        var message = ":middle_finger:";
        var options = {}
        slackApp.postMessage(SLACK_CHANNEL, message, options);
      } else {
        react(json.event.event_ts, 'ok');
      }
  }
}

// tokenをチェックすることで不正利用させない
function isInvalidToken(token) {
  return token != SLACK_VERIFICATION_TOKEN;
}
// 特定のチャンネルだけ有効
function isInvalidChannel(channel) {
  return channel != SLACK_CHANNEL;
}

function mode(user, text) {
  // slack botからのメンションは問答無用でsummary
  // 特定の言葉から始まっていたらsummary
  if (user == 'USLACKBOT' || text.startsWith('一覧')) {
    return SUMMARY_MODE;
  }
  
  return REGISTER_MODE;
}

// SpreadSheetに記録
function write(user, text) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  const index = findUserIndex(sheet, user);
  sheet.getRange(index, 1).setValue(user);
  sheet.getRange(index, 2).setValue(text);
  sheet.getRange(index, 3).setValue(now());
}

function findUserIndex(sheet, user) {
  // vlookup的なやつをする
  const values = sheet.getDataRange().getValues();
  const _ = Underscore.load();
  // 行列を転置
  const transposedValues = _.zip.apply(_, values);
  const index = transposedValues[0].indexOf(user);
  if(index >= 0) {
    return index + 1;
  }
  // 未登録なら最終行
  return sheet.getLastRow() + 1;
}

function now() {
  const date = new Date();
  return Utilities.formatDate( date, 'JST', 'yyyyMMdd');
}
// リアクションする
function react(timestamp, emoji) {
  // Slackの仕様 https://api.slack.com/methods/reactions.add
  const data = {
    'token': SLACK_ACCESS_TOKEN,
    'channel': SLACK_CHANNEL,
    'name': emoji,
    'timestamp': timestamp
  };
  const options = {
    'method' : 'post',
    'Content-Type': 'application/x-www-form-urlencoded',
    'payload' : data
  };
  UrlFetchApp.fetch('https://slack.com/api/reactions.add', options);
}

function summary() {
  // https://api.slack.com/methods/chat.postMessage
  const data = {
    'token': SLACK_ACCESS_TOKEN,
    'channel': SLACK_CHANNEL,
    'text': "今日の勤怠だ",
    'blocks' : JSON.stringify(summaryMessageBlocks())
  };
  const options = {
    'method' : 'post',
    'Content-Type': 'application/x-www-form-urlencoded',
    'payload' : data
  };
  UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', options);
}

function summaryMessageBlocks() {
  // https://api.slack.com/tools/block-kit-builder
  var blocks = [{"type": "section","text": {"type": "plain_text","text": "今日の勤怠だ"}},{"type": "divider"}];
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getActiveSheet();
  const values = sheet.getRange(1, 1, sheet.getLastRow(), 3).getValues();
  values.forEach(function(element){
    blocks.push({
      "type": "section",
      "fields": [
        {
          "type": "mrkdwn",
          "text": "<@" + element[0] + ">"
        },
        {
          "type": "mrkdwn",
          "text": element[1]
        }
      ]
    });
  });

  return blocks;
}
