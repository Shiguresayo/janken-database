
const players = JSON.parse(localStorage.getItem('janken_players') || '[]');
const records = JSON.parse(localStorage.getItem('janken_records') || '[]');

const handNames = {
  rock: 'グー',
  scissors: 'チョキ',
  paper: 'パー'
};

let selectedHands = {};

function saveData() {
  localStorage.setItem('janken_players', JSON.stringify(players));
  localStorage.setItem('janken_records', JSON.stringify(records));
}

// 手入力欄を作成
function createHandInputs() {
  const container = document.getElementById('hand-inputs');

  for (let i = 1; i <= 5; i++) {
    const row = document.createElement('div');
    row.className = 'hand-row';

    const number = document.createElement('span');
    number.className = 'hand-number';
    number.textContent = `${i}手目`;

    const options = document.createElement('div');
    options.className = 'hand-options';

    ['rock', 'scissors', 'paper'].forEach(hand => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'hand-option';
      button.textContent = handNames[hand];

      button.addEventListener('click', () => {
        selectedHands[i] = hand;

        options.querySelectorAll('button').forEach(btn => {
          btn.classList.remove('selected');
        });

        button.classList.add('selected');
      });

      options.appendChild(button);
    });

    row.appendChild(number);
    row.appendChild(options);
    container.appendChild(row);
  }
}

createHandInputs();

// プレイヤー登録
document.getElementById('player-form').addEventListener('submit', event => {
  event.preventDefault();

  const name = document.getElementById('player-name').value.trim();
  const message = document.getElementById('player-message');

  if (!name) return;

  if (players.some(player => player.name === name)) {
    message.textContent = 'このプレイヤーは既に登録されています。';
    return;
  }

  players.push({
    id: crypto.randomUUID(),
    name
  });

  saveData();

  message.textContent = `${name} を登録しました。`;
  event.target.reset();
});

// 対戦記録登録
document.getElementById('record-form').addEventListener('submit', event => {
  event.preventDefault();

  const name = document.getElementById('opponent-name').value.trim();
  const date = document.getElementById('record-date').value;
  const message = document.getElementById('record-message');

  const player = players.find(p => p.name === name);

  if (!player) {
    message.textContent = '先にプレイヤーを登録してください。';
    return;
  }

  const hands = Object.keys(selectedHands)
    .sort((a, b) => Number(a) - Number(b))
    .map(key => selectedHands[key]);

  if (!date || hands.length === 0) {
    message.textContent = '対戦日と少なくとも1手を入力してください。';
    return;
  }

  records.push({
    id: crypto.randomUUID(),
    playerId: player.id,
    date,
    hands
  });

  saveData();

  message.textContent = '対戦記録を保存しました。';

  selectedHands = {};
  document.getElementById('hand-inputs').innerHTML = '';
  createHandInputs();

  event.target.reset();
  document.getElementById('record-date').value =
    new Date().toLocaleDateString('sv-SE');
});

// プレイヤー検索
document.getElementById('search-button').addEventListener('click', searchPlayer);

document.getElementById('search-name').addEventListener('keydown', event => {
  if (event.key === 'Enter') searchPlayer();
});

function searchPlayer() {
  const name = document.getElementById('search-name').value.trim();
  const result = document.getElementById('search-results');
  const analysis = document.getElementById('analysis-area');

  const player = players.find(p => p.name === name);

  if (!player) {
    result.textContent = 'プレイヤーが見つかりません。';
    analysis.innerHTML = '<p>該当するプレイヤーのデータがありません。</p>';
    return;
  }

  const playerRecords = records.filter(r => r.playerId === player.id);

  result.innerHTML = `
    <div class="player-result">
      <h3>${escapeHTML(player.name)}</h3>
      <p>対戦記録：${playerRecords.length}件</p>
    </div>
  `;

  showAnalysis(player, playerRecords, analysis);
}

// 統計分析
function showAnalysis(player, playerRecords, container) {
  const counts = {
    rock: 0,
    scissors: 0,
    paper: 0
  };

  let total = 0;

  playerRecords.forEach(record => {
    record.hands.forEach(hand => {
      counts[hand]++;
      total++;
    });
  });

  if (total === 0) {
    container.innerHTML = '<p>まだ記録がありません。</p>';
    return;
  }

  const probabilities = {
    rock: counts.rock / total,
    scissors: counts.scissors / total,
    paper: counts.paper / total
  };

  const expectedValues = {
    rock: probabilities.scissors - probabilities.paper,
    scissors: probabilities.paper - probabilities.rock,
    paper: probabilities.rock - probabilities.scissors
  };

  const bestHand = Object.keys(expectedValues).reduce((a, b) =>
    expectedValues[a] > expectedValues[b] ? a : b
  );

  container.innerHTML = `
    <h3>${escapeHTML(player.name)} の分析結果</h3>
    <p>総記録数：${total}手</p>

    <h4>手の出現割合</h4>
    ${Object.keys(counts).map(hand => `
      <div class="record-item">
        ${handNames[hand]}：${(probabilities[hand] * 100).toFixed(1)}%
        （${counts[hand]}回）
      </div>
    `).join('')}

    <h4>期待値（勝ち +1 / 引き分け 0 / 負け -1）</h4>
    ${Object.keys(expectedValues).map(hand => `
      <div class="record-item">
        ${handNames[hand]}：
        ${expectedValues[hand] >= 0 ? '+' : ''}
        ${expectedValues[hand].toFixed(3)}
      </div>
    `).join('')}

    <div class="player-result">
      <p>期待値が最も高い手</p>
      <h2>${handNames[bestHand]}</h2>
      <p>※仮データによる単純な全体頻度分析です。</p>
    </div>

    <h4>対戦履歴</h4>
    ${playerRecords.map(record => `
      <div class="record-item">
        ${escapeHTML(record.date)}：
        ${record.hands.map(hand => handNames[hand]).join(' → ')}
      </div>
    `).join('')}
  `;
}

// HTMLエスケープ
function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[char]);
}

// 今日の日付を初期設定
document.getElementById('record-date').value =
  new Date().toLocaleDateString('sv-SE');
