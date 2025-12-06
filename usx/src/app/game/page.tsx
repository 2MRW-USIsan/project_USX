"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

export default function GamePage() {
  const router = useRouter();

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const MAX_BOMBS = 3; // 最大設置数
  const MAX_ENEMIES = 5;
  const MAX_HP = 100;

  let playerHP = 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Canvas 初期設定
    canvas.width = 400;
    canvas.height = 400;

    const size = 20; // プレイヤーサイズ
    const gridSize = 40; // グリッド1マスのサイズ

    let isGameOver = false;
    let fadeAlpha = 0; // 透明度 0 -> 1
    let hasPlayedGameOverSound = false;

    // プレイヤー
    let score = 0;
    let player = { x: 200, y: 200 };

    // 敵（仮想座標）
    const enemies = Array.from({ length: 5 }, () => ({
      x: Math.random() * 800,
      y: Math.random() * 800,
      speed: 1.0,
    }));
    const respawnQueue: { spawnTime: number }[] = [];

    const mines: { x: number; y: number }[] = [];
    let bombCount = 0;

    // キー入力
    const keys: Record<string, boolean> = {};
    const handleKeyDown = (e: KeyboardEvent) => {
      keys[e.key] = true;
      // 地雷設置
      if (e.key === " " && mines.length < MAX_BOMBS) {
        mines.push({ x: player.x, y: player.y });
        bombCount--;
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      keys[e.key] = false;
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    // スワイプ入力
    let touchStartX = 0;
    let touchStartY = 0;

    canvas.addEventListener("touchstart", (e) => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    });

    canvas.addEventListener("touchend", (e) => {
      const dx = e.changedTouches[0].clientX - touchStartX;
      const dy = e.changedTouches[0].clientY - touchStartY;

      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) keys["ArrowRight"] = true;
        else keys["ArrowLeft"] = true;
      } else {
        if (dy > 0) keys["ArrowDown"] = true;
        else keys["ArrowUp"] = true;
      }
    });
    // スマホ用にタッチ対応も追加
    canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault(); // スクロール防止
        if (mines.length < MAX_BOMBS) {
          mines.push({ x: player.x, y: player.y });
          bombCount--;
        }
      },
      { passive: false }
    );
    // sounds
    const bgmSound = new Audio("/sounds/bgm.wav");
    bgmSound.loop = true; // ループ再生
    bgmSound.volume = 0.3; // 音量調整
    const explosionSound = new Audio("/sounds/effect.wav");
    const gameOverSound = new Audio("/sounds/game-over.wav");

    // ゲームループ
    const loop = () => {
      // プレイヤー移動
      if (keys["ArrowUp"]) player.y -= 2;
      if (keys["ArrowDown"]) player.y += 2;
      if (keys["ArrowLeft"]) player.x -= 2;
      if (keys["ArrowRight"]) player.x += 2;

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
      const startX = -(player.x % gridSize);
      for (let x = startX; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      const startY = -(player.y % gridSize);
      for (let y = startY; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // 地雷描画
      ctx.fillStyle = "white";
      mines.forEach((mine) => {
        const drawX = mine.x + offsetX - size / 2;
        const drawY = mine.y + offsetY - size / 2;
        ctx.beginPath();
        ctx.moveTo(drawX, drawY - size / 2); // 頂点
        ctx.lineTo(drawX - size / 2, drawY + size / 2); // 左下
        ctx.lineTo(drawX + size / 2, drawY + size / 2); // 右下
        ctx.closePath();
        ctx.fill();
      });

      // プレイヤー描画（常に中央）
      ctx.fillStyle = "red";
      ctx.beginPath();
      ctx.arc(centerX, centerY, size / 2, 0, Math.PI * 2);
      ctx.fill();

      // 敵描画・追跡
      ctx.fillStyle = "yellow";
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        const dx = player.x - enemy.x;
        const dy = player.y - enemy.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
          enemy.x += (dx / dist) * enemy.speed;
          enemy.y += (dy / dist) * enemy.speed;
        }

        const drawX = enemy.x + offsetX - size / 2;
        const drawY = enemy.y + offsetY - size / 2;
        ctx.beginPath();
        ctx.arc(drawX, drawY, size / 2, 0, Math.PI * 2);
        ctx.fill();
        // 地雷衝突判定
        for (let j = mines.length - 1; j >= 0; j--) {
          const mine = mines[j];
          if (
            enemy.x < mine.x + size &&
            enemy.x + size > mine.x &&
            enemy.y < mine.y + size &&
            enemy.y + size > mine.y
          ) {
            enemies.splice(i, 1); // 敵消滅
            explosionSound.currentTime = 0; // 連打対応
            explosionSound.play();

            const now = performance.now();
            respawnQueue.push({ spawnTime: now + 3000 }); // 1秒後にリスポーン

            mines.splice(j, 1); // 地雷消滅
            score += 10;
            bombCount++;
            break;
          }
        }

        // ダメージ判定
        const damage = 1;
        if (
          player.x < enemy.x + size &&
          player.x + size > enemy.x &&
          player.y < enemy.y + size &&
          player.y + size > enemy.y
        ) {
          playerHP -= damage;
          if (playerHP <= 0) {
            isGameOver = true;
          }
        }
      }

      // HPBar
      const HP = parseInt(
        String((playerHP / MAX_HP > 0 ? playerHP / MAX_HP : 0) * 100)
      );
      ctx.fillStyle = "red";
      ctx.fillRect(10, 45, HP, 10);
      ctx.strokeStyle = "white";
      ctx.strokeRect(10, 45, 100, 10);

      // 画面に残りボム数表示
      ctx.fillStyle = "white";
      ctx.font = "16px sans-serif";
      ctx.fillText(`Bombs: ${MAX_BOMBS + bombCount}`, 10, 20);
      ctx.fillText(`HP: ${HP}`, 10, 40);
      ctx.fillText(`Enemies: ${enemies.length}`, 210, 20);
      ctx.fillText(`Score: ${score}`, 210, 45);

      const now = performance.now();
      for (let i = respawnQueue.length - 1; i >= 0; i--) {
        if (respawnQueue[i].spawnTime <= now) {
          enemies.push({
            x: Math.random() * 800,
            y: Math.random() * 800,
            speed: 1.0,
          });
          respawnQueue.splice(i, 1); // キューから削除
        }
      }

      if (isGameOver) {
        if (!hasPlayedGameOverSound) {
          gameOverSound.play();
          hasPlayedGameOverSound = true;
        }
        fadeAlpha += 0.02; // 0.02ずつ増やす
        if (fadeAlpha > 1) fadeAlpha = 1;
        // 画面全体を半透明黒で塗りつぶす
        ctx.fillStyle = `rgba(0, 0, 0, ${fadeAlpha})`;
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

        // フェード完了でループ終了
        if (fadeAlpha < 1) {
          requestAnimationFrame(loop);
        }
        return;
      }

      requestAnimationFrame(loop);
    };

    // bgmSound.play().catch(() => {
    //   // 自動再生制限で再生できなかった場合
    //   console.log("ユーザー操作待ち");
    // });
    loop();

    // クリーンアップ
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

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
              </button>{" "}
            </div>
          </div>
          <div className="p-4">
            <canvas ref={canvasRef} style={{ border: "1px solid white" }} />
          </div>{" "}
        </div>
      </body>
    </html>
  );
}
