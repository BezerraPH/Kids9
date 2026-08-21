/**
 * @file app.js
 * @description Lógica de Frontend Single Page Application (SPA) para os portais do Kids9.
 * Controla os fluxos de três páginas integradas:
 * 1. Portal do Operador: login de operador, check-in de crianças com máscara de telefone,
 *    busca reativa, checkout validado por PIN e bypass de supervisor.
 * 2. Painel da TV Pública: listagem reativa das crianças brincando com contadores reativos
 *    de tempo restante (formatado mm:ss), alertas sonoros/visuais para tempo expirando
 *    e mascaramento de números de telefone em conformidade com a LGPD.
 * 3. Dashboard Administrativo: login de administrador, estatísticas de faturamento diário,
 *    ocupação, histórico completo de check-ins e gráfico dinâmico de frequência horária.
 */

// ==========================================================================
// ESTADO GLOBAL DA APLICAÇÃO (SPA state persistence)
// ==========================================================================
let activeCheckins = [];               // Lista de crianças atualmente ativas (brincando)
let historyCheckins = [];              // Histórico completo de check-ins obtidos do servidor
let selectedCheckinForCheckout = null; // Armazena o registro de check-in que está passando pelo checkout
let currentAdminPin = null;            // Cache em memória do PIN do administrador ativo

// Limite padrão de capacidade de crianças no espaço de lazer
const CAPACITY_LIMIT = 20;

// ==========================================================================
// TOAST NOTIFICATIONS SYSTEM (Feedback visual premium)
// ==========================================================================
/**
 * Exibe uma notificação temporária flutuante (Toast) no canto inferior direito.
 * 
 * @param {string} message Mensagem a ser exibida.
 * @param {string} [type='info'] Tipo do toast: 'success', 'error', 'warn' ou 'info'.
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.style.cssText = `
      position: fixed;
      bottom: 24px;
      right: 24px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      z-index: 9999;
      pointer-events: none;
    `;
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.style.cssText = `
    min-width: 280px;
    max-width: 380px;
    padding: 16px 20px;
    border-radius: var(--radius-md);
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow-md);
    border-left: 5px solid var(--primary);
    font-size: 0.85rem;
    font-weight: 500;
    pointer-events: auto;
    opacity: 0;
    transform: translateY(20px);
    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  `;

  // Definir cores e ícones correspondentes com base no tipo
  if (type === 'success') {
    toast.style.borderLeftColor = 'var(--ok)';
    toast.innerHTML = `<span>🟢 &nbsp; ${message}</span>`;
  } else if (type === 'error') {
    toast.style.borderLeftColor = 'var(--crit)';
    toast.innerHTML = `<span>🔴 &nbsp; ${message}</span>`;
  } else if (type === 'warn') {
    toast.style.borderLeftColor = 'var(--warn)';
    toast.innerHTML = `<span>🟡 &nbsp; ${message}</span>`;
  } else {
    toast.style.borderLeftColor = 'var(--primary)';
    toast.innerHTML = `<span>ℹ️ &nbsp; ${message}</span>`;
  }

  // Botão de fechar (X)
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.style.cssText = `
    background: transparent;
    border: none;
    color: var(--ink-faint);
    font-size: 1.2rem;
    cursor: pointer;
    line-height: 1;
    padding: 0;
  `;
  closeBtn.addEventListener('click', () => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-20px)';
    setTimeout(() => toast.remove(), 300);
  });
  toast.appendChild(closeBtn);

  container.appendChild(toast);

  // Gatilho de animação de entrada fade-in e subida
  setTimeout(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  }, 10);

  // Remoção automática após 4 segundos
  setTimeout(() => {
    if (toast.parentNode) {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-20px)';
      setTimeout(() => toast.remove(), 300);
    }
  }, 4000);
}

// Tornar a função globalmente acessível para eventos inline no HTML
window.showToast = showToast;

// ==========================================================================
// INICIALIZADOR PRINCIPAL DO DOM (DOM Ready bootstrap)
// ==========================================================================
document.addEventListener('DOMContentLoaded', () => {
  // Identifica a página/portal ativo a partir do atributo 'data-page' definido no body
  const page = document.body.getAttribute('data-page');

  if (page === 'operator') {
    initOperatorFlow();
    syncData();
    // Agendar sincronização reativa a cada 10 segundos
    setInterval(syncData, 10000);
  } else if (page === 'tv') {
    syncData();
    // Sincronizar dados da TV com o banco a cada 10 segundos
    setInterval(syncData, 10000);
  } else if (page === 'admin') {
    initAdminDashboard();
  }

  // Atualizar relógio do topo a cada 1 segundo
  updatePhoneTime();
  setInterval(updatePhoneTime, 1000);
  
  // Atualizar regressivamente todos os timers exibidos na tela a cada 1 segundo
  setInterval(updateLiveCountdowns, 1000);
});

// ==========================================================================
// 1. RELÓGIOS E REGRESSÕES DE TEMPO (Timers & Clock Synchronization)
// ==========================================================================

/**
 * Atualiza os relógios digitais no portal do operador e no painel da TV.
 */
function updatePhoneTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  const phoneTimeEl = document.getElementById('phone-time');
  if (phoneTimeEl) phoneTimeEl.textContent = timeStr;
  
  const tvTimeEl = document.getElementById('tv-clock-display');
  if (tvTimeEl) tvTimeEl.textContent = timeStr;
}

/**
 * Consulta a API do backend buscando as crianças ativas e atualiza as telas correspondentes.
 * 
 * @async
 */
async function syncData() {
  try {
    const response = await fetch('/api/checkins/active');
    if (response.ok) {
      const result = await response.json();
      activeCheckins = result.data || [];
      
      // Atualiza a listagem de ativos no portal do operador
      renderActiveCheckins();
      // Atualiza o grid visual no painel da TV pública
      renderTVGrid();
    }

    // Se o painel administrativo estiver desbloqueado e visível, atualiza seus dados
    const adminLayoutWrapper = document.getElementById('admin-layout-wrapper');
    if (adminLayoutWrapper && adminLayoutWrapper.style.display !== 'none') {
      await updateAdminData();
    }
  } catch (error) {
    console.error('[SYNC ERROR] Falha ao sincronizar dados com o servidor HTTP:', error);
  }
}

/**
 * Varre todos os elementos com atributo 'data-remaining-target' para calcular
 * e exibir dinamicamente o tempo restante no formato MM:SS.
 * Atualiza as classes visuais dos pills de status com base no tempo restante.
 */
function updateLiveCountdowns() {
  const timeElements = document.querySelectorAll('[data-remaining-target]');
  timeElements.forEach(el => {
    try {
      const expectedTimeStr = el.getAttribute('data-remaining-target');
      if (!expectedTimeStr) return;
      
      const expectedTime = new Date(expectedTimeStr);
      if (isNaN(expectedTime.getTime())) return;

      const now = new Date();
      const diffSeconds = Math.floor((expectedTime - now) / 1000);
      
      // Se o tempo esgotou (diferença menor ou igual a zero)
      if (diffSeconds <= 0) {
        el.textContent = 'Tempo Esgotado';
        const pill = el.nextElementSibling;
        if (pill && pill.classList && pill.classList.contains('pill')) {
          pill.className = 'pill pill-crit';
          pill.textContent = 'acabando';
        }
        el.style.color = 'var(--crit)';
      } else {
        const minutes = Math.floor(diffSeconds / 60);
        const seconds = diffSeconds % 60;
        
        // Formata o contador regressivo (ex: 29:05)
        el.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // Atualização reativa de cores e textos de ajuda visual
        const pill = el.nextElementSibling;
        if (pill && pill.classList && pill.classList.contains('pill')) {
          if (minutes <= 5) {
            // Crítico (vermelho) - Faltando menos de 5 minutos
            pill.className = 'pill pill-crit';
            pill.textContent = 'acabando';
            el.style.color = 'var(--crit)';
          } else if (minutes <= 10) {
            // Alerta (laranja) - Faltando menos de 10 minutos
            pill.className = 'pill pill-warn';
            pill.textContent = 'atenção';
            el.style.color = 'var(--warn)';
          } else {
            // Seguro (cor padrão/verde) - No prazo
            pill.className = 'pill pill-ok';
            pill.textContent = 'no prazo';
            el.style.color = 'var(--ink)';
          }
        }
      }
    } catch (err) {
      console.error('Erro ao processar contagem regressiva reativa:', err);
    }
  });
}

// ==========================================================================
// 2. FLUXO DO OPERADOR - TELEFONE (Operator flow logic)
// ==========================================================================

/**
 * Inicializa ouvintes de eventos e estado do portal de login/operação.
 */
function initOperatorFlow() {
  // Verificar se o operador já estava logado na sessão do navegador
  if (sessionStorage.getItem('kids9_operator_logged') === 'true') {
    switchOperatorScreen('op-screen-active');
    syncData();
  }

  // Ação de Logout do Operador
  const logoutBtn = document.getElementById('operator-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      sessionStorage.removeItem('kids9_operator_logged');
      switchOperatorScreen('op-screen-login');
      document.getElementById('login-pin').value = '';
      showToast('Sessão de operador encerrada com sucesso.', 'info');
    });
  }

  // Formulário de Login do Operador (Autenticação local rápida por PIN "1234")
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('login-pin').value;
      
      if (pin === '1234') {
        sessionStorage.setItem('kids9_operator_logged', 'true');
        switchOperatorScreen('op-screen-active');
        syncData();
        showToast('Login de operador efetuado com sucesso!', 'success');
      } else {
        showToast('PIN incorreto! Utilize o PIN padrão "1234".', 'error');
      }
    });
  }

  // Vinculação de botões de voltar genéricos
  const backButtons = document.querySelectorAll('.back-btn');
  backButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-target');
      switchOperatorScreen(target);
    });
  });

  // Botão para abrir o formulário de novo check-in
  const openCheckinBtn = document.getElementById('open-checkin-btn');
  if (openCheckinBtn) {
    openCheckinBtn.addEventListener('click', () => {
      switchOperatorScreen('op-screen-checkin');
    });
  }

  // Seleção reativa de Chips de Atração
  const attractionChips = document.querySelectorAll('#attraction-chips .chip');
  attractionChips.forEach(chip => {
    chip.addEventListener('click', () => {
      attractionChips.forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
    });
  });

  // Seleção reativa de Chips de Tempo com atualização sugerida do valor de cobrança
  const timeChips = document.querySelectorAll('#time-chips .chip');
  const paymentValueInput = document.getElementById('checkin-payment-value');
  timeChips.forEach(chip => {
    chip.addEventListener('click', () => {
      timeChips.forEach(c => c.classList.remove('sel'));
      chip.classList.add('sel');
      
      // Atualizar o campo do valor automaticamente com base no preço sugerido no chip
      const price = chip.getAttribute('data-price');
      if (paymentValueInput) {
        paymentValueInput.value = price;
      }
    });
  });

  // Máscara de telefone interativa em tempo real: (XX) XXXXX-XXXX
  const parentPhoneInput = document.getElementById('checkin-parent-phone');
  if (parentPhoneInput) {
    parentPhoneInput.addEventListener('input', (e) => {
      let val = e.target.value.replace(/\D/g, '');
      if (val.length > 11) val = val.slice(0, 11);
      
      let formatted = val;
      if (val.length > 2) {
        formatted = `(${val.slice(0, 2)}) `;
        if (val.length > 7) {
          formatted += `${val.slice(2, 7)}-${val.slice(7)}`;
        } else {
          formatted += val.slice(2);
        }
      }
      e.target.value = formatted;
    });
  }

  // Envio de formulário de Check-in (Cadastro no banco e disparo de WhatsApp)
  const checkinForm = document.getElementById('checkin-form');
  if (checkinForm) {
    checkinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const childName = document.getElementById('checkin-child-name').value;
      const parentPhone = document.getElementById('checkin-parent-phone').value;
      
      const selectedAttractionChip = document.querySelector('#attraction-chips .chip.sel');
      const attraction = selectedAttractionChip ? selectedAttractionChip.getAttribute('data-value') : 'Piscina de bolinhas';
      
      const selectedTimeChip = document.querySelector('#time-chips .chip.sel');
      const playtimeMinutes = selectedTimeChip ? parseInt(selectedTimeChip.getAttribute('data-value'), 10) : 30;
      
      const paymentMethod = document.getElementById('checkin-payment-method').value;
      const paymentValue = parseFloat(document.getElementById('checkin-payment-value').value);

      // Bloquear botão de submit para evitar disparos em duplicidade
      const submitBtn = checkinForm.querySelector('button[type="submit"]');
      const originalText = submitBtn.textContent;
      submitBtn.disabled = true;
      submitBtn.textContent = 'Registrando...';

      try {
        const response = await fetch('/api/checkins', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            childName,
            parentPhone,
            paymentMethod,
            paymentValue,
            playtimeMinutes,
            shopping: 'Kids9 Park Iguatemi L2'
          })
        });

        if (response.ok) {
          showToast('Check-in efetuado! PIN enviado via WhatsApp.', 'success');
          checkinForm.reset();
          
          // Resetar chips de seleção para o estado original
          attractionChips.forEach(c => c.classList.remove('sel'));
          attractionChips[0].classList.add('sel');
          timeChips.forEach(c => c.classList.remove('sel'));
          timeChips[0].classList.add('sel');
          document.getElementById('checkin-payment-value').value = "30.00";
          
          // Retornar para a lista principal de ativos
          switchOperatorScreen('op-screen-active');
          syncData();
        } else {
          const err = await response.json();
          showToast('Erro no check-in: ' + (err.error || 'Tente novamente.'), 'error');
        }
      } catch (err) {
        showToast('Falha crítica na conexão com o servidor.', 'error');
        console.error(err);
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    });
  }

  // Ouvinte no campo de busca de ativos por nome
  const searchInput = document.getElementById('search-active-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      renderActiveCheckins();
    });
  }

  // Finalização do Checkout Normal (Pai informando o PIN correto)
  const confirmCheckoutBtn = document.getElementById('confirm-checkout-btn');
  if (confirmCheckoutBtn) {
    confirmCheckoutBtn.addEventListener('click', async () => {
      if (!selectedCheckinForCheckout) return;

      const pin = document.getElementById('checkout-pin-input').value;
      if (!pin) {
        showToast('Informe o código PIN de segurança enviado ao responsável.', 'warn');
        return;
      }

      confirmCheckoutBtn.disabled = true;
      const originalText = confirmCheckoutBtn.textContent;
      confirmCheckoutBtn.textContent = 'Processando...';

      try {
        const response = await fetch(`/api/checkins/${selectedCheckinForCheckout.id}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin: pin, isAdminOverride: false })
        });

        if (response.ok) {
          showToast('Saída confirmada! Criança liberada com sucesso.', 'success');
          selectedCheckinForCheckout = null;
          document.getElementById('checkout-pin-input').value = '';
          switchOperatorScreen('op-screen-active');
          syncData();
        } else {
          const err = await response.json();
          showToast('Falha ao liberar: ' + (err.error || 'PIN incorreto.'), 'error');
        }
      } catch (err) {
        showToast('Falha na comunicação com o servidor.', 'error');
        console.error(err);
      } finally {
        confirmCheckoutBtn.disabled = false;
        confirmCheckoutBtn.textContent = originalText;
      }
    });
  }

  // Controles do Modal de Desbloqueio/Bypass por Supervisor (Admin Bypass)
  const adminBypassBtn = document.getElementById('admin-bypass-btn');
  const adminModal = document.getElementById('admin-modal');
  const cancelAdminModal = document.getElementById('cancel-admin-modal');
  const confirmAdminBypass = document.getElementById('confirm-admin-bypass');
  
  if (adminBypassBtn) {
    adminBypassBtn.addEventListener('click', () => {
      if (adminModal) adminModal.classList.add('active');
    });
  }
  
  if (cancelAdminModal) {
    cancelAdminModal.addEventListener('click', () => {
      if (adminModal) adminModal.classList.remove('active');
      const pinInput = document.getElementById('admin-bypass-pin-input');
      if (pinInput) pinInput.value = '';
    });
  }
  
  if (confirmAdminBypass) {
    confirmAdminBypass.addEventListener('click', async () => {
      const pinInput = document.getElementById('admin-bypass-pin-input');
      const adminPin = pinInput ? pinInput.value : '';
      
      // Validação rápida no client-side para evitar requisições desnecessárias
      if (adminPin !== '4321') {
        showToast('PIN de Administrador incorreto!', 'error');
        return;
      }

      confirmAdminBypass.disabled = true;
      const originalText = confirmAdminBypass.textContent;
      confirmAdminBypass.textContent = 'Liberando...';
      
      try {
        const response = await fetch(`/api/checkins/${selectedCheckinForCheckout.id}/checkout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isAdminOverride: true, adminPin: adminPin })
        });
        
        if (response.ok) {
          showToast('Desbloqueio efetuado! Criança liberada.', 'success');
          selectedCheckinForCheckout = null;
          
          const checkoutPinInput = document.getElementById('checkout-pin-input');
          if (checkoutPinInput) checkoutPinInput.value = '';
          if (adminModal) adminModal.classList.remove('active');
          if (pinInput) pinInput.value = '';
          
          switchOperatorScreen('op-screen-active');
          syncData();
        } else {
          const err = await response.json();
          showToast('Erro na liberação administrativa: ' + (err.error || 'Tente novamente.'), 'error');
        }
      } catch (err) {
        showToast('Falha na comunicação com o servidor.', 'error');
      } finally {
        confirmAdminBypass.disabled = false;
        confirmAdminBypass.textContent = originalText;
      }
    });
  }

  // Extensão de tempo simulada no checkout
  const extendBtn = document.getElementById('extend-time-btn');
  if (extendBtn) {
    extendBtn.addEventListener('click', () => {
      showToast('Extensão de 15 minutos adicionada na simulação.', 'info');
    });
  }
}

/**
 * Transiciona entre as telas da Single Page Application (SPA) do operador.
 * 
 * @param {string} screenId ID da div contendo a tela de destino
 */
function switchOperatorScreen(screenId) {
  const screens = document.querySelectorAll('.screen-content');
  screens.forEach(s => s.classList.remove('active'));
  
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
}

/**
 * Compila e renderiza a lista de crianças ativas na tela do operador.
 * Calcula e gera barras de progresso baseadas na ocupação total do parquinho.
 */
function renderActiveCheckins() {
  const listEl = document.getElementById('op-active-list');
  if (!listEl) return;

  const filterText = document.getElementById('search-active-input').value.toLowerCase().trim();
  const filtered = activeCheckins.filter(c => c.child_name.toLowerCase().includes(filterText));

  // Atualizar o contador de capacidade atual no painel do operador
  const count = activeCheckins.length;
  document.getElementById('active-ratio').textContent = `${count} / ${CAPACITY_LIMIT}`;
  const pct = Math.min((count / CAPACITY_LIMIT) * 100, 100);
  document.getElementById('active-progress-bar').style.width = `${pct}%`;

  if (filtered.length === 0) {
    listEl.innerHTML = `<div class="empty-state">${filterText ? 'Nenhum resultado para a busca.' : 'Nenhuma criança ativa no momento.'}</div>`;
    return;
  }

  listEl.innerHTML = '';
  filtered.forEach(c => {
    const row = document.createElement('div');
    row.className = 'list-row';
    
    // Vincula clique para abrir a tela de confirmação de checkout daquela criança
    row.addEventListener('click', () => {
      openCheckoutScreen(c);
    });

    const expectedTime = new Date(c.expected_checkout_time);
    const now = new Date();
    const diffMin = Math.floor((expectedTime - now) / 60000);
    
    let pillClass = 'pill-ok';
    let pillText = 'no prazo';
    
    if (diffMin <= 5) {
      pillClass = 'pill-crit';
      pillText = 'acabando';
    } else if (diffMin <= 10) {
      pillClass = 'pill-warn';
      pillText = 'atenção';
    }

    row.innerHTML = `
      <div class="avatar">🧒</div>
      <div class="who">
        <div class="name">${c.child_name}</div>
        <div class="attr">${c.payment_method} · ${c.playtime_minutes} min</div>
      </div>
      <div class="time-col">
        <div class="time" data-remaining-target="${c.expected_checkout_time}">--:--</div>
        <span class="pill ${pillClass}">${pillText}</span>
      </div>
    `;
    listEl.appendChild(row);
  });
}

/**
 * Abre a tela de checkout populada com as informações da criança selecionada.
 * 
 * @param {object} checkin Detalhes do registro de check-in selecionado
 */
function openCheckoutScreen(checkin) {
  selectedCheckinForCheckout = checkin;
  const receiptEl = document.getElementById('checkout-receipt');
  
  const checkinTime = new Date(checkin.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const expectedCheckout = new Date(checkin.expected_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  
  receiptEl.innerHTML = `
    <div class="rr"><span class="k">Criança</span><span class="v">${checkin.child_name}</span></div>
    <div class="rr"><span class="k">Atração</span><span class="v">Brinquedo Kids9</span></div>
    <hr>
    <div class="rr"><span class="k">Entrada</span><span class="v">${checkinTime}</span></div>
    <div class="rr"><span class="k">Saída prevista</span><span class="v">${expectedCheckout}</span></div>
    <hr>
    <div class="rr"><span class="k">Tempo contratado</span><span class="v">${checkin.playtime_minutes} min</span></div>
    <div class="rr"><span class="k">Valor pago</span><span class="v">R$ ${parseFloat(checkin.payment_value).toFixed(2)}</span></div>
  `;

  switchOperatorScreen('op-screen-checkout');
}

// ==========================================================================
// 3. PAINEL DA TV PÚBLICA (TV Monitoring Panel)
// ==========================================================================

/**
 * Desenha os cartões das crianças ativas no painel da TV e controla
 * a barra dinâmica de alertas no rodapé para prazos críticos de saída.
 */
function renderTVGrid() {
  const gridEl = document.getElementById('tv-grid-container');
  if (!gridEl) return;

  const footerAlert = document.getElementById('tv-footer-alert');
  const alertName = document.getElementById('tv-alert-name');
  
  // Alerta no rodapé da TV se houver alguma criança com menos de 5 minutos restantes
  if (footerAlert && alertName) {
    const endingSoonKids = activeCheckins.filter(c => {
      const expectedTime = new Date(c.expected_checkout_time);
      const now = new Date();
      const diffMin = Math.floor((expectedTime - now) / 60000);
      return diffMin <= 5;
    });

    if (endingSoonKids.length > 0) {
      alertName.textContent = endingSoonKids.map(c => c.child_name).join(', ');
      footerAlert.style.display = 'block';
    } else {
      footerAlert.style.display = 'none';
    }
  }

  // Se não houver ninguém brincando, exibe aviso convidando novos clientes
  if (activeCheckins.length === 0) {
    gridEl.innerHTML = `<div class="empty-state" style="color:#9ca3af; border-color:rgba(255,255,255,0.08);">Nenhuma criança ativa no momento. Aproveite as vagas livres!</div>`;
    return;
  }

  gridEl.innerHTML = '';
  activeCheckins.forEach(c => {
    const expectedTime = new Date(c.expected_checkout_time);
    const now = new Date();
    const diffMin = Math.floor((expectedTime - now) / 60000);
    
    // Classes de status visual
    let cardClass = '';
    if (diffMin <= 5) {
      cardClass = 'crit';
    } else if (diffMin <= 10) {
      cardClass = 'warn';
    }

    // Mascarar o telefone do responsável para proteção de dados sensíveis (LGPD)
    const formattedPhone = formatPhoneMasked(c.parent_phone);

    const card = document.createElement('div');
    card.className = `tv-card ${cardClass}`;
    card.innerHTML = `
      <div class="kid-info">
        <h3>${c.child_name}</h3>
        <p>Responsável: ${formattedPhone}</p>
      </div>
      <div class="time-info">
        <div class="tv-time" data-remaining-target="${c.expected_checkout_time}">--:--</div>
      </div>
    `;
    gridEl.appendChild(card);
  });
}

/**
 * Helper para mascarar o celular exibido publicamente na TV (ex: (81) 9 ****-1234).
 * 
 * @param {string} phone Celular bruto
 * @returns {string} Celular mascarado de forma segura
 */
function formatPhoneMasked(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length >= 10) {
    const ddd = digits.slice(-11, -9);
    const firstDigit = digits.slice(-9, -8);
    const lastDigits = digits.slice(-4);
    return `(${ddd}) ${firstDigit} ****-${lastDigits}`;
  }
  return '****-' + digits.slice(-4);
}

// ==========================================================================
// 4. PAINEL ADMINISTRATIVO (Desktop Administrative Dashboard)
// ==========================================================================

/**
 * Configura ouvintes de formulários, persistência de abas e login administrativo.
 */
function initAdminDashboard() {
  // Verificar se o PIN de admin já está salvo na sessão do navegador
  const savedPin = sessionStorage.getItem('kids9_admin_pin');
  if (savedPin === '4321') {
    currentAdminPin = savedPin;
    document.getElementById('admin-login-screen').style.display = 'none';
    document.getElementById('admin-layout-wrapper').style.display = 'flex';
    updateAdminData();
    setInterval(updateAdminData, 10000);
  }

  // Logout Administrativo
  const logoutLink = document.querySelector('.admin-sidebar a.sidebar-item[href="index.html"]');
  if (logoutLink) {
    logoutLink.addEventListener('click', () => {
      sessionStorage.removeItem('kids9_admin_pin');
    });
  }

  // Persistência local das configurações de tempo de antecedência do aviso
  const configForm = document.getElementById('config-form');
  if (configForm) {
    const alertMinutesInput = configForm.querySelector('input[type="number"]');
    if (alertMinutesInput) {
      if (localStorage.getItem('kids9_alert_minutes')) {
        alertMinutesInput.value = localStorage.getItem('kids9_alert_minutes');
      }
      const saveBtn = configForm.querySelector('.btn-primary');
      if (saveBtn) {
        saveBtn.removeAttribute('onclick');
        saveBtn.addEventListener('click', (e) => {
          e.preventDefault();
          localStorage.setItem('kids9_alert_minutes', alertMinutesInput.value);
          showToast('Configurações salvas localmente com sucesso!', 'success');
        });
      }
    }
  }

  // Formulário de Autenticação do Administrador (PIN padrão "4321")
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const pin = document.getElementById('admin-pin-input').value;
      if (pin === '4321') {
        currentAdminPin = pin;
        sessionStorage.setItem('kids9_admin_pin', pin);
        document.getElementById('admin-login-screen').style.display = 'none';
        document.getElementById('admin-layout-wrapper').style.display = 'flex';
        updateAdminData();
        // Sincronizar dados do admin a cada 10 segundos
        setInterval(updateAdminData, 10000);
        showToast('Painel Administrativo liberado.', 'success');
      } else {
        showToast('PIN de Administrador incorreto!', 'error');
      }
    });
  }

  // Navegação de abas (tabs) da barra lateral do admin
  const sidebarItems = document.querySelectorAll('.admin-sidebar .sidebar-item');
  sidebarItems.forEach(item => {
    item.addEventListener('click', () => {
      sidebarItems.forEach(i => i.classList.remove('active'));
      item.classList.add('active');

      const targetPageId = item.getAttribute('data-page');
      const pages = document.querySelectorAll('.admin-page');
      pages.forEach(p => p.classList.remove('active'));

      const targetPage = document.getElementById(targetPageId);
      if (targetPage) targetPage.classList.add('active');
    });
  });

  // Busca interativa na tabela de histórico geral do admin
  const historySearch = document.getElementById('history-search');
  if (historySearch) {
    historySearch.addEventListener('input', () => {
      renderAdminHistoryTable();
    });
  }
}

/**
 * Busca estatísticas financeiras e histórico do servidor
 * e atualiza todos os componentes estatísticos e gráficos do Admin.
 * 
 * @async
 */
async function updateAdminData() {
  if (!currentAdminPin) return;
  try {
    const headers = { 'x-admin-pin': currentAdminPin };
    
    // 1. Requisitar KPIs agregados e gráfico de ocupação
    const statsResponse = await fetch('/api/checkins/stats', { headers });
    if (statsResponse.ok) {
      const result = await statsResponse.json();
      const stats = result.data;

      // Inserir valores nos cards de KPI
      document.getElementById('kpi-active').textContent = stats.activeCount;
      document.getElementById('kpi-active-desc').textContent = `De ${CAPACITY_LIMIT} do plano`;
      document.getElementById('kpi-revenue').textContent = `R$ ${stats.revenueToday.toFixed(2)}`;
      document.getElementById('kpi-avg-ticket').textContent = `R$ ${stats.avgTicket.toFixed(2)}`;
      document.getElementById('kpi-total-checkins').textContent = stats.totalCount;

      // Desenhar o gráfico de ocupação horária por barras
      renderAdminChart(stats.hourlyData);
    }

    // 2. Requisitar histórico completo (últimos 100 check-ins)
    const historyResponse = await fetch('/api/checkins/history', { headers });
    if (historyResponse.ok) {
      const result = await historyResponse.json();
      historyCheckins = result.data || [];
      
      // Renderizar tabela de check-ins recentes (Dashboard) e tabela histórica completa (Histórico)
      renderAdminRecentTable();
      renderAdminHistoryTable();
    }
  } catch (error) {
    console.error('[ADMIN FETCH ERROR] Falha ao recuperar métricas estatísticas:', error);
  }
}

/**
 * Renderiza a tabela de check-ins recentes (limite 5 itens) no painel principal do Admin.
 */
function renderAdminRecentTable() {
  const tbody = document.getElementById('admin-recent-tbody');
  if (!tbody) return;

  const recents = historyCheckins.slice(0, 5);

  if (recents.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">Nenhum check-in recente registrado hoje.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  recents.forEach(c => {
    const tr = document.createElement('tr');
    const checkinTime = new Date(c.checkin_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    let timeColContent = '';
    let pillClass = '';
    let pillText = '';

    if (c.status === 'completed') {
      const checkoutTime = new Date(c.actual_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
      timeColContent = checkoutTime;
      pillClass = 'pill-ok';
      pillText = 'finalizado';
    } else {
      timeColContent = `<span data-remaining-target="${c.expected_checkout_time}">--:--</span>`;
      pillClass = 'pill-ok';
      pillText = 'ativo';
    }

    tr.innerHTML = `
      <td class="mono">#${c.id}</td>
      <td class="name">${c.child_name}</td>
      <td>${c.payment_method}</td>
      <td class="mono">${checkinTime}</td>
      <td class="mono">${timeColContent}</td>
      <td class="mono">R$ ${parseFloat(c.payment_value).toFixed(2)}</td>
      <td><span class="pill ${pillClass}">${pillText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Renderiza a tabela completa do Histórico administrativo com suporte a filtros reativos.
 */
function renderAdminHistoryTable() {
  const tbody = document.getElementById('admin-history-tbody');
  if (!tbody) return;

  const searchVal = document.getElementById('history-search').value.toLowerCase().trim();
  const filtered = historyCheckins.filter(c => 
    c.child_name.toLowerCase().includes(searchVal) || 
    c.parent_phone.includes(searchVal)
  );

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-state">Nenhum registro correspondente ao filtro.</td></tr>`;
    return;
  }

  tbody.innerHTML = '';
  filtered.forEach(c => {
    const tr = document.createElement('tr');
    
    const checkinTime = new Date(c.checkin_time).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
    const checkoutTime = c.actual_checkout_time 
      ? new Date(c.actual_checkout_time).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) 
      : 'Ativo';
    
    let pillClass = c.status === 'active' ? 'pill-warn' : 'pill-ok';
    let statusText = c.status === 'active' ? 'ativo' : 'saída';

    tr.innerHTML = `
      <td class="mono">#${c.id}</td>
      <td class="name">${c.child_name}</td>
      <td>${c.parent_phone}</td>
      <td>Brinquedo Kids9</td>
      <td class="mono">${c.playtime_minutes} min</td>
      <td class="mono">${checkinTime}</td>
      <td class="mono">${checkoutTime}</td>
      <td class="mono">${c.pin}</td>
      <td class="mono">R$ ${parseFloat(c.payment_value).toFixed(2)}</td>
      <td><span class="pill ${pillClass}">${statusText}</span></td>
    `;
    tbody.appendChild(tr);
  });
}

/**
 * Desenha o gráfico de barras de ocupação do dia de hoje.
 * Filtra para exibir apenas o horário comercial padrão (10h às 22h).
 * 
 * @param {object[]} hourlyData Dados brutos agrupados por hora do servidor
 */
function renderAdminChart(hourlyData) {
  const chartEl = document.getElementById('occupancy-chart');
  if (!chartEl) return;

  // Filtrar apenas o horário de funcionamento comercial comum para exibir no gráfico (10h às 22h)
  const startHour = 10;
  const endHour = 22;
  const filteredHours = hourlyData.filter(d => d.hour >= startHour && d.hour <= endHour);

  // Encontrar o maior pico para calcular porcentagem de altura proporcional das colunas do gráfico
  const counts = filteredHours.map(d => d.count);
  const maxCount = Math.max(...counts, 1); // Evitar divisão por zero

  chartEl.innerHTML = '';
  filteredHours.forEach(d => {
    const pct = (d.count / maxCount) * 100;
    
    const bar = document.createElement('div');
    bar.className = 'chart-col-wrap';

    bar.innerHTML = `
      <div class="chart-col" style="height: ${pct}%;" ${d.count === maxCount && maxCount > 0 ? 'style="background: var(--primary);"' : ''}>
        <div class="chart-col-val">${d.count}</div>
      </div>
      <div class="chart-col-label">${d.hour}h</div>
    `;
    chartEl.appendChild(bar);
  });
}
