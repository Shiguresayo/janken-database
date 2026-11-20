
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

function showAnalysis(player, playerRecords, container) {
  const handKeys = ['rock', 'scissors', 'paper'];

  const handNames = {
    rock: 'グー',
    scissors: 'チョキ',
    paper: 'パー'
  };

  function createCounts() {
    return {
      rock: 0,
      scissors: 0,
      paper: 0
    };
  }

  function totalCounts(counts) {
    return handKeys.reduce((sum, hand) => sum + counts[hand], 0);
  }

  // 期待値を計算
  function calculateExpectedValues(counts) {
    const total = totalCounts(counts);

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

  // 最も期待値の高い手を取得
  function getBestHands(counts) {
    const values = calculateExpectedValues(counts);

    if (!values) return [];

    const maxValue = Math.max(...Object.values(values));

    return handKeys.filter(
      hand => Math.abs(values[hand] - maxValue) < 0.000001
    );
  }

  // 推奨手カード
  function recommendationCard(title, counts, condition = '') {
    const total = totalCounts(counts);
    const bestHands = getBestHands(counts);

    if (total === 0) {
      return `
        <div class="janken-card">
          <h4>${title}</h4>
          <p>${condition}</p>
          <p>データ不足</p>
          <small>0件</small>
        </div>
      `;
    }

    const values = calculateExpectedValues(counts);
    const bestValue = Math.max(...Object.values(values));

    return `
      <div class="janken-card">
        <h4>${title}</h4>
        <p class="janken-condition">${condition}</p>
        <div class="recommended-hand">
          ${bestHands.map(hand => handNames[hand]).join(' / ')}
        </div>
        <p>期待値：${bestValue >= 0 ? '+' : ''}${bestValue.toFixed(3)}</p>
        <small>集計：${total}件</small>
      </div>
    `;
  }

  // 確率カード
  function probabilityCard(title, counts, condition = '') {
    const total = totalCounts(counts);

    return `
      <div class="janken-card">
        <h4>${title}</h4>
        <p class="janken-condition">${condition}</p>

        ${total === 0
          ? '<p>データ不足</p>'
          : `
            <div class="probability-list">
              ${handKeys.map(hand => `
                <div class="probability-item">
                  <span>${handNames[hand]}</span>
                  <strong>
                    ${(counts[hand] / total * 100).toFixed(1)}%
                  </strong>
                </div>
              `).join('')}
            </div>
          `
        }

        <small>集計：${total}件</small>
      </div>
    `;
  }

  // 集計用データ
  const firstCounts = createCounts();
  const overallCounts = createCounts();

  const secondCounts = {
    rock: createCounts(),
    scissors: createCounts(),
    paper: createCounts()
  };

  const thirdCounts = {
    rock: {
      rock: createCounts(),
      scissors: createCounts(),
      paper: createCounts()
    },
    scissors: {
      rock: createCounts(),
      scissors: createCounts(),
      paper: createCounts()
    },
    paper: {
      rock: createCounts(),
      scissors: createCounts(),
      paper: createCounts()
    }
  };

  // 全記録を集計
  playerRecords.forEach(record => {
    const hands = record.hands;

    if (!Array.isArray(hands) || hands.length === 0) return;

    // 全体の出現回数
    hands.forEach(hand => {
      if (overallCounts[hand] !== undefined) {
        overallCounts[hand]++;
      }
    });

    const first = hands[0];

    if (firstCounts[first] === undefined) return;

    firstCounts[first]++;

    if (hands.length >= 2) {
      const second = hands[1];

      if (secondCounts[first][second] !== undefined) {
        secondCounts[first][second]++;
      }
    }

    if (hands.length >= 3) {
      const second = hands[1];
      const third = hands[2];

      if (thirdCounts[first][second][third] !== undefined) {
        thirdCounts[first][second][third]++;
      }
    }
  });

  // 初手の推奨手
  const firstBestHands = getBestHands(firstCounts);

  if (totalCounts(firstCounts) === 0) {
    container.innerHTML = '<p>まだ記録がありません。</p>';
    return;
  }

  // 初手の推奨手に該当する記録だけを抽出
  const selectedRecords = playerRecords.filter(record => {
    const first = record.hands?.[0];
    return firstBestHands.includes(first);
  });

  // 初手の推奨手を出した場合の二手目
  const selectedSecondCounts = createCounts();

  // 初手の推奨手を出した場合の三手目
  const selectedThirdCounts = {
    rock: createCounts(),
    scissors: createCounts(),
    paper: createCounts()
  };

  selectedRecords.forEach(record => {
    const hands = record.hands;

    if (hands.length >= 2) {
      const second = hands[1];

      if (selectedSecondCounts[second] !== undefined) {
        selectedSecondCounts[second]++;
      }
    }

    if (hands.length >= 3) {
      const second = hands[1];
      const third = hands[2];

      if (selectedThirdCounts[second][third] !== undefined) {
        selectedThirdCounts[second][third]++;
      }
    }
  });

  // 二手目の推奨手
  const secondBestHands = getBestHands(selectedSecondCounts);

  // 三手目の推奨手を二手目ごとに計算
  const thirdRecommendationHTML = handKeys.map(second => {
    return recommendationCard(
      `二手目が${handNames[second]}の場合`,
      selectedThirdCounts[second],
      '三手目の推奨'
    );
  }).join('');

  // 三手目の確率を二手目ごとに表示
  const thirdProbabilityHTML = handKeys.map(second => {
    return probabilityCard(
      `二手目が${handNames[second]}の場合`,
      selectedThirdCounts[second]
    );
  }).join('');

  // 四手目以降
  const fourthBestHands = getBestHands(overallCounts);

  const recommendationHTML = `
    <div class="janken-grid">
      ${recommendationCard('1手目', firstCounts)}
      ${recommendationCard(
        '2手目',
        selectedSecondCounts,
        `初手：${firstBestHands.map(hand => handNames[hand]).join(' / ')}`
      )}
      <div class="janken-card">
        <h4>3手目</h4>
        <p class="janken-condition">
          初手：${firstBestHands.map(hand => handNames[hand]).join(' / ')}
        </p>
        ${thirdRecommendationHTML}
      </div>
      ${recommendationCard(
        '4手目以降',
        overallCounts,
        '全記録の全手を対象'
      )}
    </div>
  `;

  // 確率表示
  const probabilityHTML = `
    <div class="janken-grid">
      ${probabilityCard('初手の確率', firstCounts)}

      ${probabilityCard(
        '二手目の確率',
        selectedSecondCounts,
        `初手：${firstBestHands.map(hand => handNames[hand]).join(' / ')}`
      )}

      <div class="janken-card">
        <h4>三手目の確率</h4>
        <p class="janken-condition">
          初手：${firstBestHands.map(hand => handNames[hand]).join(' / ')}
        </p>
        ${thirdProbabilityHTML}
      </div>

      ${probabilityCard('全体の確率', overallCounts)}
    </div>
  `;

  container.innerHTML = `
    <h3>${escapeHTML(player.name)} の分析結果</h3>

    <p>対戦記録：${playerRecords.length}件</p>

    <section class="analysis-section">
      <h3>推奨手</h3>
      ${recommendationHTML}
    </section>

    <section class="analysis-section">
      <h3>出現確率</h3>
      ${probabilityHTML}
    </section>

    <p class="sample-count">
      ※推奨手は勝ち＋1、引き分け0、負け－1の期待値で算出しています。
      同じ期待値の手は複数表示します。
      二手目・三手目は初手の推奨手に該当する記録を対象にしています。
      四手目以降は全記録の全手を対象にしています。
    </p>
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
