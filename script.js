
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
  // 全体の手の出現回数
  const counts = {
    rock: 0,
    scissors: 0,
    paper: 0
  };

  let total = 0;

  // 初手の出現回数
  const firstHandCounts = {
    rock: 0,
    scissors: 0,
    paper: 0
  };

  let firstHandTotal = 0;

  // 初手ごと・手数ごとの出現回数
  // firstBranch.rock[1] は「初手グーだった試合の2手目」
  const firstBranch = {
    rock: {},
    scissors: {},
    paper: {}
  };

  handKeys.forEach(firstHand => {
    for (let position = 2; position <= 5; position++) {
      firstBranch[firstHand][position] = {
        rock: 0,
        scissors: 0,
        paper: 0
      };
    }
  });

  // 直前の手から次の手への遷移
  const transitions = {};

  handKeys.forEach(hand => {
    transitions[hand] = {
      rock: 0,
      scissors: 0,
      paper: 0
    };
  });

  let transitionTotal = 0;

  // 記録を集計
  playerRecords.forEach(record => {
    const hands = record.hands;

    if (!hands || hands.length === 0) return;

    // 全体の出現回数
    hands.forEach(hand => {
      if (counts[hand] !== undefined) {
        counts[hand]++;
        total++;
      }
    });

    // 初手の集計
    const firstHand = hands[0];

    if (firstHandCounts[firstHand] !== undefined) {
      firstHandCounts[firstHand]++;
      firstHandTotal++;
    }

    // 初手から各手への分岐集計
    if (firstBranch[firstHand]) {
      for (let i = 1; i < hands.length; i++) {
        const nextHand = hands[i];

        if (firstBranch[firstHand][i + 1]) {
          firstBranch[firstHand][i + 1][nextHand]++;
        }
      }
    }

    // 直前の手から次の手への遷移集計
    for (let i = 1; i < hands.length; i++) {
      const previousHand = hands[i - 1];
      const nextHand = hands[i];

      if (
        transitions[previousHand] &&
        transitions[previousHand][nextHand] !== undefined
      ) {
        transitions[previousHand][nextHand]++;
        transitionTotal++;
      }
    }
  });

  if (total === 0) {
    container.innerHTML = '<p>まだ記録がありません。</p>';
    return;
  }

  // 全体の出現確率
  const probabilities = {
    rock: counts.rock / total,
    scissors: counts.scissors / total,
    paper: counts.paper / total
  };

  // 期待値
  const expectedValues = {
    rock: probabilities.scissors - probabilities.paper,
    scissors: probabilities.paper - probabilities.rock,
    paper: probabilities.rock - probabilities.scissors
  };

  const bestHand = handKeys.reduce((a, b) =>
    expectedValues[a] > expectedValues[b] ? a : b
  );

  // 初手確率の表示
  const firstHandHTML = handKeys.map(hand => {
    const probability = firstHandTotal > 0
      ? firstHandCounts[hand] / firstHandTotal
      : 0;

    return `
      <div class="record-item">
        <strong>${handNames[hand]}</strong>：
        ${(probability * 100).toFixed(1)}%
        （${firstHandCounts[hand]}回）
      </div>
    `;
  }).join('');

  // 初手ごとの分岐確率の表示
  const firstBranchHTML = handKeys.map(firstHand => {
    const sampleCount = firstHandCounts[firstHand];

    let positionHTML = '';

    for (let position = 2; position <= 5; position++) {
      const branchCounts = firstBranch[firstHand][position];
      const branchTotal = handKeys.reduce(
        (sum, hand) => sum + branchCounts[hand],
        0
      );

      if (branchTotal === 0) continue;

      positionHTML += `
        <div class="branch-position">
          <h5>${position}手目</h5>
          <p class="sample-count">
            該当記録：${branchTotal}件
          </p>
          ${handKeys.map(hand => {
            const probability = branchCounts[hand] / branchTotal;

            return `
              <div class="record-item">
                ${handNames[hand]}：
                ${(probability * 100).toFixed(1)}%
                （${branchCounts[hand]}回）
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    return `
      <div class="branch-card">
        <h4>初手が${handNames[firstHand]}の場合</h4>
        <p class="sample-count">
          初手の該当試合数：${sampleCount}件
        </p>
        ${
          sampleCount === 0
            ? '<p>該当する記録がありません。</p>'
            : positionHTML || '<p>2手目以降の記録がありません。</p>'
        }
      </div>
    `;
  }).join('');

  // 直前の手からの遷移確率
  const transitionHTML = handKeys.map(previousHand => {
    const rowTotal = handKeys.reduce(
      (sum, hand) => sum + transitions[previousHand][hand],
      0
    );

    return `
      <div class="branch-card">
        <h4>直前が${handNames[previousHand]}の場合</h4>
        <p class="sample-count">該当遷移：${rowTotal}回</p>
        ${
          rowTotal === 0
            ? '<p>該当する記録がありません。</p>'
            : handKeys.map(hand => `
              <div class="record-item">
                ${handNames[hand]}：
                ${(transitions[previousHand][hand] / rowTotal * 100).toFixed(1)}%
                （${transitions[previousHand][hand]}回）
              </div>
            `).join('')
        }
      </div>
    `;
  }).join('');

  container.innerHTML = `
    <h3>${escapeHTML(player.name)} の分析結果</h3>

    <p>総記録数：${total}手</p>
    <p>対戦記録数：${playerRecords.length}試合</p>

    <h4>1. 全体の手の出現割合</h4>
    ${handKeys.map(hand => `
      <div class="record-item">
        ${handNames[hand]}：
        ${(probabilities[hand] * 100).toFixed(1)}%
        （${counts[hand]}回）
      </div>
    `).join('')}

    <h4>2. 初手の出現確率</h4>
    <p class="sample-count">
      初手の集計対象：${firstHandTotal}試合
    </p>
    ${firstHandHTML}

    <h4>3. 初手からの分岐確率</h4>
    <p class="sample-count">
      初手を条件として、2〜5手目の分布を集計しています。
    </p>
    ${firstBranchHTML}

    <h4>4. 直前の手からの遷移確率</h4>
    <p class="sample-count">
      集計対象：${transitionTotal}回の手の遷移
    </p>
    ${transitionHTML}

    <h4>5. 期待値（勝ち +1 / 引き分け 0 / 負け -1）</h4>
    ${handKeys.map(hand => `
      <div class="record-item">
        ${handNames[hand]}：
        ${expectedValues[hand] >= 0 ? '+' : ''}
        ${expectedValues[hand].toFixed(3)}
      </div>
    `).join('')}

    <div class="player-result">
      <p>期待値が最も高い手</p>
      <h2>${handNames[bestHand]}</h2>
      <p>※全体の出現頻度から計算した理論上の期待値です。</p>
    </div>

    <h4>6. 対戦履歴</h4>
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
