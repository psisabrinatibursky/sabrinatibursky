document.addEventListener('DOMContentLoaded', () => {
  const player = document.getElementById('vslPlayer');
  if (!player) return;

  const video = player.querySelector('.vsl-video');
  const initialOverlay = document.getElementById('vslInitialOverlay');
  const smartOverlay = document.getElementById('vslSmartOverlay');
  const resumeOverlay = document.getElementById('vslResumeOverlay');
  const recoveryOverlay = document.getElementById('vslRecoveryOverlay');
  const controls = document.getElementById('vslControls');

  const unmuteBtn = document.getElementById('vslUnmuteBtn');
  const resumeBtn = document.getElementById('vslResumeBtn');
  const resumeContinue = document.getElementById('vslResumeContinue');
  const resumeRestart = document.getElementById('vslResumeRestart');
  const savedTimeLabel = document.getElementById('vslSavedTime');
  const recoveryBtn = document.getElementById('vslRecoveryBtn');
  const progressFill = document.getElementById('vslProgressFill');

  // Chave única no navegador para o recurso "Continuar Assistindo"
  const videoId = player.dataset.videoId || video.getAttribute('src') || 'default';
  const STORAGE_KEY = `vsl_watch_progress_${videoId}`;

  // Fator de aceleração da barra de progresso falsa (2.5 = rápido no início, suave no fim)
  const PROGRESS_CURVE_FACTOR = 2.5;

  let isEngaged = false; // Só libera o clique para pausar depois que o som for ativado
  let lastSavedSecond = 0;

  function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  function hideAllOverlays() {
    initialOverlay.classList.add('hidden');
    smartOverlay.classList.add('hidden');
    resumeOverlay.classList.add('hidden');
    recoveryOverlay.classList.add('hidden');
  }

  // Inicia a reprodução real com som em 100%
  function startEngagedPlayback(startTime = 0) {
    isEngaged = true;
    hideAllOverlays();
    controls.classList.remove('hidden');

    if (typeof startTime === 'number' && !isNaN(startTime)) {
      video.currentTime = startTime;
    }

    video.muted = false;
    video.volume = 1; // Volume padrão fixo em 100%
    video.play().catch(() => {
      initialOverlay.classList.remove('hidden');
    });
  }

  // 1. Inicialização: Verifica "Continuar Assistindo" ou inicia "Smart Autoplay"
  function initPlayer() {
    const savedTime = parseFloat(localStorage.getItem(STORAGE_KEY) || '0');

    if (savedTime > 5) {
      savedTimeLabel.textContent = formatTime(savedTime);
      hideAllOverlays();
      resumeOverlay.classList.remove('hidden');

      const handleContinue = () => startEngagedPlayback(savedTime);
      resumeBtn.addEventListener('click', handleContinue);
      resumeContinue.addEventListener('click', handleContinue);
      resumeRestart.addEventListener('click', () => {
        localStorage.removeItem(STORAGE_KEY);
        startEngagedPlayback(0);
      });
      return;
    }

    // Smart Autoplay: vídeo rodando no mudo ao fundo
    video.muted = true;
    video.loop = true;
    const playPromise = video.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          hideAllOverlays();
          smartOverlay.classList.remove('hidden');
        })
        .catch(() => {
          hideAllOverlays();
          initialOverlay.classList.remove('hidden');
        });
    }
  }

  // Ativação do som (libera o controle de clique na tela)
  smartOverlay.addEventListener('click', () => {
    video.loop = false;
    startEngagedPlayback(0);
  });

  unmuteBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    video.loop = false;
    startEngagedPlayback(0);
  });

  initialOverlay.addEventListener('click', () => {
    video.loop = false;
    startEngagedPlayback(0);
  });

  // 2. Barra de Progresso Falsa / Acelerada (apenas visual, sem clique)
  function updateFakeProgress() {
    if (isEngaged && video.duration > 0) {
      const realRatio = Math.min(Math.max(video.currentTime / video.duration, 0), 1);
      const fakeRatio = 1 - Math.pow(1 - realRatio, PROGRESS_CURVE_FACTOR);
      progressFill.style.width = `${(fakeRatio * 100).toFixed(2)}%`;
    }
    requestAnimationFrame(updateFakeProgress);
  }
  requestAnimationFrame(updateFakeProgress);

  // 3. Salva progresso no localStorage para "Continuar Assistindo"
  video.addEventListener('timeupdate', () => {
    if (!isEngaged || !video.duration) return;

    const currentSec = Math.floor(video.currentTime);
    if (video.currentTime / video.duration >= 0.95) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }

    if (Math.abs(currentSec - lastSavedSecond) >= 2) {
      lastSavedSecond = currentSec;
      localStorage.setItem(STORAGE_KEY, video.currentTime.toFixed(1));
    }
  });

  // 4. Pausar/Retomar APENAS clicando na tela do vídeo (e somente após liberar o som)
  video.addEventListener('click', () => {
    if (!isEngaged) return;

    if (video.paused) {
      hideAllOverlays();
      video.play();
    } else {
      video.pause();
    }
  });

  video.addEventListener('pause', () => {
    if (isEngaged && !video.ended) {
      recoveryOverlay.classList.remove('hidden');
    }
  });

  video.addEventListener('play', () => {
    if (isEngaged) {
      recoveryOverlay.classList.add('hidden');
    }
  });

  video.addEventListener('ended', () => {
    localStorage.removeItem(STORAGE_KEY);
    recoveryOverlay.classList.remove('hidden');
  });

  // Retoma o vídeo ao clicar na thumbnail de recuperação (thumb.jpg)
  const resumeFromRecovery = () => {
    if (!isEngaged) return;
    hideAllOverlays();
    video.play();
  };

  recoveryOverlay.addEventListener('click', resumeFromRecovery);
  recoveryBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    resumeFromRecovery();
  });

  // Bloqueia menu de clique direito no vídeo
  video.addEventListener('contextmenu', (e) => e.preventDefault());

  initPlayer();
});