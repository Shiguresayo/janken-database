
const players = JSON.parse(localStorage.getItem('janken_players') || '[]');
const records = JSON.parse(localStorage.getItem('janken_records') || '[]');

const handNames = {
  rock: 'グー',
  scissors: 'チョキ',
  paper: 'パー'
};

const handKeys = ['rock', 'scissors', 'paper'];

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

    handKeys.forEach(hand => {
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

  // 手の回数を初期化
  function createCounts() {
    return {
      rock: 0,
      scissors: 0,
      paper: 0
    };
  }

  // 期待値を計算
  function calculateExpectedValues(counts) {
    const total = handKeys.reduce(
      (sum, hand) => sum + counts[hand],
      0
    );

    if (total === 0) return null;

    const p = {
      rock: counts.rock / total,
      scissors: counts.scissors / total,
      paper: counts.paper / total
    };

    return {
      rock: p.scissors - p.paper,
      scissors: p.paper - p.rock,
      paper: p.rock - p.scissors
    };
  }

  // 期待値が最も高い手を取得
  function getBestHand(counts) {
    const values = calculateExpectedValues(counts);

    if (!values) return [];

    const maxValue = Math.max(...Object.values(values));

    return handKeys.filter(
      hand => Math.abs(values[hand] - maxValue) < 0.000001
    );
  }

  // 確率表示
  function probabilityHTML(counts) {
    const total = handKeys.reduce(
      (sum, hand) => sum + counts[hand],
      0
    );

    if (total === 0) {
      return '<p>データがありません。</p>';
    }

    return `
      <div class="probability-list">
        ${handKeys.map(hand => `
          <div class="record-item">
            ${handNames[hand]}：
            ${(counts[hand] / total * 100).toFixed(1)}%
            （${counts[hand]}回）
          </div>
        `).join('')}
      </div>
    `;
  }

  // 推奨手表示
  function recommendationHTML(counts) {
    const total = handKeys.reduce(
      (sum, hand) => sum + counts[hand],
      0
    );

    if (total === 0) {
      return `
        <div class="player-result">
          <p>推奨手</p>
          <p>データ不足</p>
        </div>
      `;
    }

    const bestHands = getBestHand(counts);
    const values = calculateExpectedValues(counts);

    return `
      <div class="player-result">
        <p>期待値が最も高い手</p>
        <h2>
          ${bestHands.map(hand => handNames[hand]).join(' / ')}
        </h2>
        <p>
          期待値：
          ${Math.max(...Object.values(values)) >= 0 ? '+' : ''}
          ${Math.max(...Object.values(values)).toFixed(3)}
        </p>
      </div>
    `;
  }

  // 初手の集計
  const firstCounts = createCounts();

  // 二手目の集計：初手ごと
  const secondCounts = {
    rock: createCounts(),
    scissors: createCounts(),
    paper: createCounts()
  };

  // 三手目の集計：初手と二手目の組み合わせごと
  const thirdCounts = {};

  handKeys.forEach(first => {
    thirdCounts[first] = {};

    handKeys.forEach(second => {
      thirdCounts[first][second] = createCounts();
    });
  });

  // 全体の出現回数：四手目以降の分析に使用
  const overallCounts = createCounts();

  // 対戦記録を集計
  playerRecords.forEach(record => {
    const hands = record.hands;

    if (!Array.isArray(hands) || hands.length === 0) return;

    // 全体の手の出現回数
    hands.forEach(hand => {
      if (overallCounts[hand] !== undefined) {
        overallCounts[hand]++;
      }
    });

    // 初手
    const first = hands[0];

    if (firstCounts[first] === undefined) return;

    firstCounts[first]++;

    // 二手目
    if (hands.length >= 2) {
      const second = hands[1];

      if (secondCounts[first] &&
          secondCounts[first][second] !== undefined) {
        secondCounts[first][second]++;
      }
    }

    // 三手目
    if (hands.length >= 3) {
      const second = hands[1];
      const third = hands[2];

      if (
        thirdCounts[first] &&
        thirdCounts[first][second] &&
        thirdCounts[first][second][third] !== undefined
      ) {
        thirdCounts[first][second][third]++;
      }
    }
  });

  const totalFirst = handKeys.reduce(
    (sum, hand) => sum + firstCounts[hand],
    0
  );

  const totalOverall = handKeys.reduce(
    (sum, hand) => sum + overallCounts[hand],
    0
  );

  if (totalFirst === 0) {
    container.innerHTML = '<p>まだ記録がありません。</p>';
    return;
  }

  // 初手の分析
  const firstHTML = `
    <section class="analysis-section">
      <h4>1. 初手</h4>
      <p>全試合の初手の出現確率</p>
      <p>集計対象：${totalFirst}試合</p>

      ${probabilityHTML(firstCounts)}
      ${recommendationHTML(firstCounts)}
    </section>
  `;

  // 二手目の分析
  const secondHTML = `
    <section class="analysis-section">
      <h4>2. 二手目</h4>
      <p>相手の初手を条件とした二手目の出現確率</p>

      ${handKeys.map(first => {
        const counts = secondCounts[first];

        const total = handKeys.reduce(
          (sum, hand) => sum + counts[hand],
          0
        );

        return `
          <div class="branch-card">
            <h4>相手の初手：${handNames[first]}</h4>
            <p>集計対象：${total}試合</p>

            ${probabilityHTML(counts)}
            ${recommendationHTML(counts)}
          </div>
        `;
      }).join('')}
    </section>
  `;

  // 三手目の分析
  const thirdHTML = `
    <section class="analysis-section">
      <h4>3. 三手目</h4>
      <p>相手の初手と二手目を条件とした三手目の出現確率</p>

      ${handKeys.map(first => `
        <div class="branch-card">
          <h4>相手の初手：${handNames[first]}</h4>

          ${handKeys.map(second => {
            const counts = thirdCounts[first][second];

            const total = handKeys.reduce(
              (sum, hand) => sum + counts[hand],
              0
            );

            return `
              <div class="branch-position">
                <h5>相手の二手目：${handNames[second]}</h5>
                <p>集計対象：${total}試合</p>

                ${probabilityHTML(counts)}
                ${recommendationHTML(counts)}
              </div>
            `;
          }).join('')}
        </div>
      `).join('')}
    </section>
  `;

  // 四手目以降の分析
  const fourthHTML = `
    <section class="analysis-section">
      <h4>4. 四手目以降</h4>
      <p>全対戦の全手を対象とした出現確率</p>
      <p>集計対象：${totalOverall}手</p>

      ${probabilityHTML(overallCounts)}
      ${recommendationHTML(overallCounts)}

      <p class="sample-count">
        ※四手目以降は、過去の全対戦における手の出現傾向を使った共通の推奨です。
      </p>
    </section>
  `;

  // 分析画面
  container.innerHTML = `
    <h3>${escapeHTML(player.name)} の分析結果</h3>

    <p>対戦記録：${playerRecords.length}件</p>

    ${firstHTML}
    ${secondHTML}
    ${thirdHTML}
    ${fourthHTML}
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
