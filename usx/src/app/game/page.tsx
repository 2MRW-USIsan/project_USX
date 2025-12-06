"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function GamePage() {
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas設定
    canvas.width = 400;
    canvas.height = 400;

    const size = 20; // プレイヤーサイズ
    const gridSize = 40;

    const MAX_BOMBS = 3;
    const MAX_HP = 100;

    let playerHP = MAX_HP;
    let score = 0;

    let isGameOver = false;
    let fadeAlpha = 0;
    let hasPlayedGameOverSound = false;

    // プレイヤー
    const player = { x: 200, y: 200, speed: 2 };

    // 敵
    const enemies = Array.from({ length: 5 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 800,
      speed: 1,
    }));
    const respawnQueue: { spawnTime: number }[] = [];

    // 地雷
    const mines: { x: number; y: number }[] = [];
    let bombCount = 0;
    let lastPlaceTime = 0;
    const PLACE_COOLDOWN = 200;

    // 移動ベクトル
    let moveX = 0;
    let moveY = 0;

    // Audio
    const bgmSound = new Audio("/sounds/bgm.wav");
    bgmSound.loop = true;
    bgmSound.volume = 0.3;

    const explosionSound = new Audio("/sounds/effect.wav");
    const gameOverSound = new Audio("/sounds/game-over.wav");

    // ボム設置関数
    function placeBomb() {
      const now = performance.now();
      if (now - lastPlaceTime < PLACE_COOLDOWN) return;
      if (mines.length >= MAX_BOMBS) return;

      mines.push({ x: player.x, y: player.y });
      lastPlaceTime = now;
    }

    // PC操作
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "ArrowUp" || e.key === "w") moveY = -1;
      if (e.key === "ArrowDown" || e.key === "s") moveY = 1;
      if (e.key === "ArrowLeft" || e.key === "a") moveX = -1;
      if (e.key === "ArrowRight" || e.key === "d") moveX = 1;
      if (e.key === " " || e.key === "Spacebar") placeBomb();
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (["ArrowUp", "w", "ArrowDown", "s"].includes(e.key)) moveY = 0;
      if (["ArrowLeft", "a", "ArrowRight", "d"].includes(e.key)) moveX = 0;
    }
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    // Canvasクリックでボム設置
    canvas.addEventListener("click", () => placeBomb());

    // スマホ操作
    let touchStartX = 0;
    let touchStartY = 0;
    canvas.addEventListener("touchstart", (e) => {
      const t = e.touches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    });
    canvas.addEventListener("touchmove", (e) => {
      e.preventDefault();
      const t = e.touches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        moveX = Math.sign(dx);
        moveY = Math.sign(dy);
      }
    });
    canvas.addEventListener("touchend", (e) => {
      const dx = Math.abs(touchStartX - e.changedTouches[0].clientX);
      const dy = Math.abs(touchStartY - e.changedTouches[0].clientY);
      if (dx < 10 && dy < 10) placeBomb();
      moveX = 0;
      moveY = 0;
    });

    // ゲームループ
    const loop = () => {
      if (!isGameOver) {
        player.x += moveX * player.speed;
        player.y += moveY * player.speed;
      }

      // 画面クリア
      ctx.fillStyle = "black";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      const offsetX = centerX - player.x;
      const offsetY = centerY - player.y;

      // グリッド描画
      ctx.strokeStyle = "green";
      ctx.lineWidth = 1;
      for (let x = -(player.x % gridSize); x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = -(player.y % gridSize); y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 地雷描画（三角）
      ctx.fillStyle = "white";
      mines.forEach((mine) => {
        const drawX = mine.x + offsetX;
        const drawY = mine.y + offsetY;
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - size / 2);
        ctx.lineTo(drawX - size / 2, drawY + size / 2);
        ctx.lineTo(drawX + size / 2, drawY + size / 2);
        ctx.closePath();
        ctx.fill();
      });

      // プレイヤー描画（中央円）
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // 敵描画
      ctx.fillStyle = "yellow";
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0 && !isGameOver) {
          enemy.x += (dx / dist) * enemy.speed;
          enemy.y += (dy / dist) * enemy.speed;
        }

        const drawX = enemy.x + offsetX;
        const drawY = enemy.y + offsetY;
        ctx.beginPath();
        ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
        ctx.fill();

        // 地雷判定
        for (let j = mines.length - 1; j >= 0; j--) {
          const mine = mines[j];
          if (
            enemy.x < mine.x + size &&
            enemy.x + size > mine.x &&
            enemy.y < mine.y + size &&
            enemy.y + size > mine.y
          ) {
            enemies.splice(i, 1);
            explosionSound.currentTime = 0;
            explosionSound.play();
            respawnQueue.push({ spawnTime: performance.now() + 1000 });
            mines.splice(j, 1);
            score += 10;
            bombCount++;
            break;
          }
        }

        // ダメージ判定
        if (
          player.x < enemy.x + size &&
          player.x + size > enemy.x &&
          player.y < enemy.y + size &&
          player.y + size > enemy.y
        ) {
          if (!isGameOver) playerHP -= 1;
          if (playerHP <= 0) isGameOver = true;
        }
      }
      // HPバー
      const HP = Math.max(0, (playerHP / MAX_HP) * 100);
      ctx.fillStyle = "red";
      ctx.fillRect(10, 45, HP, 10);
      ctx.strokeStyle = "white";
      ctx.strokeRect(10, 45, 100, 10);

      // 情報表示
      ctx.fillStyle = "white";
      ctx.font = "16px sans-serif";
      ctx.fillText(`Bombs: ${MAX_BOMBS + bombCount}`, 10, 20);
      ctx.fillText(`HP: ${Math.floor(HP)}`, 10, 40);
      ctx.fillText(`Enemies: ${enemies.length}`, 210, 20);
      ctx.fillText(`Score: ${score}`, 210, 45);

      // 敵リスポーン
      const now = performance.now();
      for (let i = respawnQueue.length - 1; i >= 0; i--) {
        if (respawnQueue[i].spawnTime <= now) {
          enemies.push({
            x: Math.random() * 800,
            y: Math.random() * 800,
            speed: 1,
          });
          respawnQueue.splice(i, 1);
        }
      }
      // ゲームオーバーフェード
      if (isGameOver) {
        if (!hasPlayedGameOverSound) {
          gameOverSound.play();
          hasPlayedGameOverSound = true;
        }
        fadeAlpha = Math.min(1, fadeAlpha + 0.02);
        ctx.fillStyle = `rgba(0,0,0,${fadeAlpha})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.strokeStyle = "green";
        ctx.beginPath();
        ctx.moveTo(0, 160);
        ctx.lineTo(canvas.width, 160);
        ctx.stroke();
        ctx.moveTo(0, 220);
        ctx.lineTo(canvas.width, 220);
        ctx.stroke();

        ctx.fillStyle = "red";
        ctx.font = "32px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("SIGNAL TERMINATED", canvas.width / 2, canvas.height / 2);

        if (fadeAlpha < 1) requestAnimationFrame(loop);
        return;
      }

      requestAnimationFrame(loop);
    };

    bgmSound.play();
    loop();

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  // const MAX_BOMBS = 3; // 最大設置数
  // const MAX_ENEMIES = 5;
  // const MAX_HP = 100;

  // let playerHP = 100;

  // useEffect(() => {
  //   const canvas = canvasRef.current;
  //   if (!canvas) return;

  //   const ctx = canvas.getContext("2d");
  //   if (!ctx) return;

  //   // Canvas 初期設定
  //   canvas.width = 400;
  //   canvas.height = 400;

  //   const size = 20; // プレイヤーサイズ
  //   const gridSize = 40; // グリッド1マスのサイズ

  //   let isGameOver = false;
  //   let fadeAlpha = 0; // 透明度 0 -> 1
  //   let hasPlayedGameOverSound = false;

  //   // スコア
  //   let score = 0;
  //   // プレイヤー（仮想マップ座標） — speed を追加
  //   let player = {
  //     x: 200,
  //     y: 200,
  //     speed: 2, // ← 移動ピクセル/フレーム（好みで変更）
  //   };

  //   // 敵（仮想座標）
  //   const enemies = Array.from({ length: 5 }, () => ({
  //     x: Math.random() * 800,
  //     y: Math.random() * 800,
  //     speed: 1.0,
  //   }));
  //   const respawnQueue: { spawnTime: number }[] = [];

  //   const mines: { x: number; y: number }[] = [];
  //   let bombCount = 0;
  //   // ボム設置クールダウン（ms）
  //   let lastPlaceTime = 0;
  //   const PLACE_COOLDOWN = 200; // 0.2秒。長押しで連続設置するのを防ぐ
  //   // ボム設置関数（player の現在座標に設置）
  //   function placeBomb() {
  //     const now = performance.now();
  //     if (now - lastPlaceTime < PLACE_COOLDOWN) return; // クールダウン中は無視

  //     if (mines.length >= MAX_BOMBS) {
  //       // もう置けない（必要なら UI で知らせる）
  //       return;
  //     }

  //     mines.push({ x: player.x, y: player.y });
  //     lastPlaceTime = now;

  //     // もし効果音があればここで鳴らす（AudioはuseEffect内で作成しておくこと）
  //     // explosionSound.play(); // ← これは設置音ならコメントアウト外して使う
  //   }

  //   // 移動ベクトル
  //   let moveX = 0;
  //   let moveY = 0;

  //   let touchStartX = 0;
  //   let touchStartY = 0;
  //   let touchActive = false;

  //   canvas.addEventListener("touchstart", (e) => {
  //     const t = e.touches[0];
  //     touchStartX = t.clientX;
  //     touchStartY = t.clientY;
  //     touchActive = true;
  //   });
  //   canvas.addEventListener("touchmove", (e) => {
  //     e.preventDefault(); // スクロール防止
  //     const t = e.touches[0];
  //     const dx = t.clientX - touchStartX;
  //     const dy = t.clientY - touchStartY;

  //     // しきい値 10px 以上動いたら方向入力とみなす
  //     if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
  //       moveX = Math.sign(dx);
  //       moveY = Math.sign(dy);
  //     }
  //   });
  //   canvas.addEventListener("touchend", (e) => {
  //     // ほぼ動かなかった → タップ扱い
  //     const dx = Math.abs(touchStartX - e.changedTouches[0].clientX);
  //     const dy = Math.abs(touchStartY - e.changedTouches[0].clientY);

  //     if (dx < 10 && dy < 10) {
  //       placeBomb(); // ボム設置
  //     }

  //     moveX = 0;
  //     moveY = 0;
  //     touchActive = false;
  //   });
  //   // キー操作
  //   window.addEventListener("keydown", (e) => {
  //     if (e.key === "ArrowUp" || e.key === "w") moveY = -1;
  //     if (e.key === "ArrowDown" || e.key === "s") moveY = 1;
  //     if (e.key === "ArrowLeft" || e.key === "a") moveX = -1;
  //     if (e.key === "ArrowRight" || e.key === "d") moveX = 1;

  //     if (e.key === " " || e.key === "Spacebar") {
  //       placeBomb();
  //     }
  //   });
  //   window.addEventListener("keyup", (e) => {
  //     moveX = 0;
  //     moveY = 0;
  //   });

  //   // sounds
  //   const bgmSound = new Audio("/sounds/bgm.wav");
  //   bgmSound.loop = true; // ループ再生
  //   bgmSound.volume = 0.3; // 音量調整
  //   const explosionSound = new Audio("/sounds/effect.wav");
  //   const gameOverSound = new Audio("/sounds/game-over.wav");

  //   // ゲームループ
  //   const loop = () => {
  //     // プレイヤー移動
  //     player.x += moveX * player.speed;
  //     player.y += moveY * player.speed;

  //     // 画面クリア
  //     ctx.fillStyle = "black";
  //     ctx.fillRect(0, 0, canvas.width, canvas.height);

  //     const centerX = canvas.width / 2;
  //     const centerY = canvas.height / 2;

  //     const offsetX = centerX - player.x;
  //     const offsetY = centerY - player.y;

  //     // グリッド描画
  //     ctx.strokeStyle = "green";
  //     ctx.lineWidth = 1;
  //     const startX = -(player.x % gridSize);
  //     for (let x = startX; x < canvas.width; x += gridSize) {
  //       ctx.beginPath();
  //       ctx.moveTo(x, 0);
  //       ctx.lineTo(x, canvas.height);
  //       ctx.stroke();
  //     }
  //     const startY = -(player.y % gridSize);
  //     for (let y = startY; y < canvas.height; y += gridSize) {
  //       ctx.beginPath();
  //       ctx.moveTo(0, y);
  //       ctx.lineTo(canvas.width, y);
  //       ctx.stroke();
  //     }

  //     // 地雷描画
  //     ctx.fillStyle = "white";
  //     mines.forEach((mine) => {
  //       const drawX = mine.x + offsetX - size / 2;
  //       const drawY = mine.y + offsetY - size / 2;
  //       ctx.beginPath();
  //       ctx.moveTo(drawX, drawY - size / 2); // 頂点
  //       ctx.lineTo(drawX - size / 2, drawY + size / 2); // 左下
  //       ctx.lineTo(drawX + size / 2, drawY + size / 2); // 右下
  //       ctx.closePath();
  //       ctx.fill();
  //     });

  //     // プレイヤー描画（常に中央）
  //     ctx.fillStyle = "red";
  //     ctx.beginPath();
  //     ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
  //     ctx.fill();

  //     // 敵描画・追跡
  //     ctx.fillStyle = "yellow";
  //     for (let i = enemies.length - 1; i >= 0; i--) {
  //       const enemy = enemies[i];
  //       const dx = player.x - enemy.x;
  //       const dy = player.y - enemy.y;
  //       const dist = Math.sqrt(dx * dx + dy * dy);
  //       if (dist > 0) {
  //         enemy.x += (dx / dist) * enemy.speed;
  //         enemy.y += (dy / dist) * enemy.speed;
  //       }

  //       const drawX = enemy.x + offsetX - size / 2;
  //       const drawY = enemy.y + offsetY - size / 2;
  //       ctx.beginPath();
  //       ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
  //       ctx.fill();
  //       // 地雷衝突判定
  //       for (let j = mines.length - 1; j >= 0; j--) {
  //         const mine = mines[j];
  //         if (
  //           enemy.x < mine.x + size &&
  //           enemy.x + size > mine.x &&
  //           enemy.y < mine.y + size &&
  //           enemy.y + size > mine.y
  //         ) {
  //           enemies.splice(i, 1); // 敵消滅
  //           explosionSound.currentTime = 0; // 連打対応
  //           explosionSound.play();

  //           const now = performance.now();
  //           respawnQueue.push({ spawnTime: now + 3000 }); // 1秒後にリスポーン

  //           mines.splice(j, 1); // 地雷消滅
  //           score += 10;
  //           bombCount++;
  //           break;
  //         }
  //       }

  //       // ダメージ判定
  //       const damage = 1;
  //       if (
  //         player.x < enemy.x + size &&
  //         player.x + size > enemy.x &&
  //         player.y < enemy.y + size &&
  //         player.y + size > enemy.y
  //       ) {
  //         playerHP -= damage;
  //         if (playerHP <= 0) {
  //           isGameOver = true;
  //         }
  //       }
  //     }

  //     // HPBar
  //     const HP = parseInt(
  //       String((playerHP / MAX_HP > 0 ? playerHP / MAX_HP : 0) * 100)
  //     );
  //     ctx.fillStyle = "red";
  //     ctx.fillRect(10, 45, HP, 10);
  //     ctx.strokeStyle = "white";
  //     ctx.strokeRect(10, 45, 100, 10);

  //     // 画面に残りボム数表示
  //     ctx.fillStyle = "white";
  //     ctx.font = "16px sans-serif";
  //     ctx.fillText(`Bombs: ${MAX_BOMBS + bombCount}`, 10, 20);
  //     ctx.fillText(`HP: ${HP}`, 10, 40);
  //     ctx.fillText(`Enemies: ${enemies.length}`, 210, 20);
  //     ctx.fillText(`Score: ${score}`, 210, 45);

  //     const now = performance.now();
  //     for (let i = respawnQueue.length - 1; i >= 0; i--) {
  //       if (respawnQueue[i].spawnTime <= now) {
  //         enemies.push({
  //           x: Math.random() * 800,
  //           y: Math.random() * 800,
  //           speed: 1.0,
  //         });
  //         respawnQueue.splice(i, 1); // キューから削除
  //       }
  //     }

  //     if (isGameOver) {
  //       if (!hasPlayedGameOverSound) {
  //         gameOverSound.play();
  //         hasPlayedGameOverSound = true;
  //       }
  //       fadeAlpha += 0.02; // 0.02ずつ増やす
  //       if (fadeAlpha > 1) fadeAlpha = 1;
  //       // 画面全体を半透明黒で塗りつぶす
  //       ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
  //       ctx.fillRect(0, 0, canvas.width, canvas.height);

  //       ctx.strokeStyle = "green";
  //       ctx.beginPath();
  //       ctx.moveTo(0, 160);
  //       ctx.lineTo(canvas.width, 160);
  //       ctx.stroke();
  //       ctx.moveTo(0, 220);
  //       ctx.lineTo(canvas.width, 220);
  //       ctx.stroke();

  //       ctx.fillStyle = "red";
  //       ctx.font = "32px sans-serif";
  //       ctx.textAlign = "center";
  //       ctx.fillText("SIGNAL TERMINATED", canvas.width / 2, canvas.height / 2);

  //       // フェード完了でループ終了
  //       if (fadeAlpha < 1) {
  //         requestAnimationFrame(loop);
  //       }
  //       return;
  //     }

  //     requestAnimationFrame(loop);
  //   };

  //   bgmSound.play();
  //   loop();

  //   // クリーンアップ
  //   return () => {
  //     window.removeEventListener("keydown", handleKeyDown);
  //     window.removeEventListener("keyup", handleKeyUp);
  //   };
  // }, []);

  return (
    <html>
      <body
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: "2rem",
        }}
      >
        <div className="p-4">
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: "2rem",
            }}
          >
            <h1>RogueLike Game</h1>
            <div>
              <button
                onClick={() => router.push("/game")}
                className="px-4 py-2 bg-blue-500 text-white rounded"
              >
                Game Start
              </button>
            </div>
          </div>
          <div className="p-4">
            <canvas ref={canvasRef} style={{ border: "1px solid white" }} />
          </div>
        </div>
      </body>
    </html>
  );
}
