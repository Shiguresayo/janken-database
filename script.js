
// =====================================
// Supabase 接続設定
// =====================================

const SUPABASE_URL = 'https://opavtvcczutgzsoayvit.supabase.co;
const SUPABASE_ANON_KEY = 'sb_publishable_csiIbzeZPShZNm7qH09CCg_UC14egUP';

const db = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_ANON_KEY
);


// =====================================
// 基本設定
// =====================================

const handNames = {
  rock: 'グー',
  scissors: 'チョキ',
  paper: 'パー'
};

const handKeys = ['rock', 'scissors', 'paper'];

let players = [];
let selectedHands = {};


// =====================================
// プレイヤー一覧取得
// =====================================

async function loadPlayers() {
  const { data, error } = await db
    .from('players')
    .select('id, name');

  if (error) {
    console.error(error);
    throw error;
  }

  players = data || [];
}


// =====================================
// 手入力欄の作成
// =====================================

function createHandInputs() {
  const container = document.getElementById('hand-inputs');

  container.innerHTML = '';

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


// =====================================
// プレイヤー登録
// =====================================

document.getElementById('player-form')
  .addEventListener('submit', async event => {

    event.preventDefault();

    const name = document
      .getElementById('player-name')
      .value.trim();

    const message = document.getElementById('player-message');

    if (!name) return;

    message.textContent = '登録中...';

    const { data, error } = await db
      .from('players')
      .insert([{ name }])
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        message.textContent = 'このプレイヤーは既に登録されています。';
      } else {
        console.error(error);
        message.textContent = '登録に失敗しました。';
      }
      return;
    }

    players.push(data);

    message.textContent = `${name} を登録しました。`;

    event.target.reset();
  });


// =====================================
// 対戦記録登録
// =====================================

document.getElementById('record-form')
  .addEventListener('submit', async event => {

    event.preventDefault();

    const name = document
      .getElementById('opponent-name')
      .value.trim();

    const date = document.getElementById('record-date').value;

    const message = document.getElementById('record-message');

    if (!name || !date) {
      message.textContent = '対戦相手と対戦日を入力してください。';
      return;
    }

    const hands = Object.keys(selectedHands)
      .sort((a, b) => Number(a) - Number(b))
      .map(key => selectedHands[key]);

    if (hands.length === 0) {
      message.textContent = '少なくとも1手を入力してください。';
      return;
    }

    // 最新のプレイヤー一覧を取得
    try {
      await loadPlayers();
    } catch {
      message.textContent = 'プレイヤー情報を取得できませんでした。';
      return;
    }

    const player = players.find(
      p => p.name.toLowerCase() === name.toLowerCase()
    );

    if (!player) {
      message.textContent = 'プレイヤーが見つかりません。先に登録してください。';
      return;
    }

    message.textContent = '保存中...';

    const record = {
      player_id: player.id,
      played_at: `${date}T12:00:00`,
      hand_1: hands[0] || null,
      hand_2: hands[1] || null,
      hand_3: hands[2] || null,
      hand_4: hands[3] || null,
      hand_5: hands[4] || null
    };

    const { error } = await db
      .from('records')
      .insert([record]);

    if (error) {
      console.error(error);
      message.textContent = '対戦記録の保存に失敗しました。';
      return;
    }

    message.textContent = '対戦記録を保存しました。';

    selectedHands = {};

    createHandInputs();

    event.target.reset();

    document.getElementById('record-date').value =
      new Date().toLocaleDateString('sv-SE');
  });


// =====================================
// プレイヤー検索
// =====================================

document.getElementById('search-button')
  .addEventListener('click', searchPlayer);

document.getElementById('search-name')
  .addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      searchPlayer();
    }
  });


async function searchPlayer() {
  const name = document
    .getElementById('search-name')
    .value.trim();

  const result = document.getElementById('search-results');
  const analysis = document.getElementById('analysis-area');

  if (!name) {
    result.textContent = 'ハンドルネームを入力してください。';
    return;
  }

  result.textContent = '検索中...';

  // サーバーからプレイヤー一覧を取得
  try {
    await loadPlayers();
  } catch {
    result.textContent = 'データベースへの接続に失敗しました。';
    return;
  }

  const player = players.find(
    p => p.name.toLowerCase() === name.toLowerCase()
  );

  if (!player) {
    result.textContent = 'プレイヤーが見つかりません。';
    analysis.innerHTML = '<p>該当するプレイヤーのデータがありません。</p>';
    return;
  }

  // 対戦記録を取得
  const { data, error } = await db
    .from('records')
    .select('*')
    .eq('player_id', player.id)
    .order('played_at', { ascending: true });

  if (error) {
    console.error(error);
    result.textContent = '対戦記録の取得に失敗しました。';
    return;
  }

  // DBのカラム形式を既存の分析形式に変換
  const playerRecords = (data || []).map(record => ({
    id: record.id,
    playerId: record.player_id,
    date: record.played_at,
    hands: [
      record.hand_1,
      record.hand_2,
      record.hand_3,
      record.hand_4,
      record.hand_5
    ].filter(hand => hand !== null)
  }));

  result.innerHTML = `
    <div class="player-result">
      <h3>${escapeHTML(player.name)}</h3>
      <p>対戦記録：${playerRecords.length}件</p>
    </div>
  `;

  showAnalysis(player, playerRecords, analysis);
}


// =====================================
// 初期化
// =====================================

async function initialize() {
  createHandInputs();

  document.getElementById('record-date').value =
    new Date().toLocaleDateString('sv-SE');

  try {
    await loadPlayers();
    console.log('Supabase接続成功');
  } catch (error) {
    console.error('Supabase接続失敗:', error);
    document.getElementById('player-message').textContent =
      'データベースに接続できません。接続設定を確認してください。';
  }
}

initialize();


// ここから下に既存の showAnalysis() が続く


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
