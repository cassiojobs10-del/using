// site.js - Motor Dinâmico do Site Público e Agendamentos
let barbearia = null;
let profissionais = [];
let servicos = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Identificar slug pela URL (/b/slug ou ?b=slug)
  const pathParts = window.location.pathname.split('/');
  let slug = null;
  
  if (pathParts[1] === 'b' && pathParts[2]) {
    slug = pathParts[2];
  } else {
    const urlParams = new URLSearchParams(window.location.search);
    slug = urlParams.get('b');
  }

  if (!slug) {
    document.getElementById('loadingView').innerHTML = '<p style="color: var(--danger-color);">Barbearia não especificada na URL.</p>';
    return;
  }

  // Buscar barbearia no Supabase
  const { data: barb, error } = await supabase
    .from('barbearias')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !barb) {
    document.getElementById('loadingView').innerHTML = '<p style="color: var(--danger-color);">Barbearia não encontrada.</p>';
    return;
  }

  barbearia = barb;
  document.title = `${barb.nome} - Agendamento Online`;

  // Preencher cabeçalho
  document.getElementById('barbNome').textContent = barb.nome;
  document.getElementById('barbFrase').textContent = barb.frase || 'O melhor estilo para si.';
  
  if (barb.logotipo) {
    document.getElementById('logoContainer').innerHTML = `<img src="${barb.logotipo}" style="width:100%; height:100%; border-radius:50%; object-fit:cover;">`;
  } else {
    document.getElementById('logoContainer').textContent = barb.nome.substring(0, 2).toUpperCase();
  }

  if (barb.capa) {
    document.getElementById('headerBg').style.backgroundImage = `url('${barb.capa}')`;
  }

  // Botão Fale Conosco
  const zapNum = barb.whatsapp ? barb.whatsapp.replace(/\D/g, '') : '';
  const btnZap = document.getElementById('btnFaleConosco');
  if (zapNum) {
    btnZap.href = `https://wa.me/55${zapNum}?text=` + encodeURIComponent(`Olá, gostaria de tirar uma dúvida com a ${barb.nome}.`);
  } else {
    btnZap.style.display = 'none';
  }

  // Informações de contato
  document.getElementById('infoEndereco').textContent = barb.endereco || 'Endereço não informado';
  document.getElementById('infoHorario').textContent = barb.horario_texto || 'Consulte horários disponíveis';
  document.getElementById('infoContato').textContent = `Tel: ${barb.telefone || '-'} | Pix: ${barb.pix || 'Consulte'}`;

  // Seção Sobre
  if (barb.sobre_titulo || barb.sobre_texto) {
    document.getElementById('sobreSecao').style.display = 'block';
    if (barb.sobre_titulo) document.getElementById('sobreTitulo').textContent = barb.sobre_titulo;
    if (barb.sobre_texto) document.getElementById('sobreTexto').textContent = barb.sobre_texto;
    if (barb.sobre_foto) {
      const fotoSobre = document.getElementById('sobreFoto');
      fotoSobre.src = barb.sobre_foto;
      fotoSobre.style.display = 'block';
    }
  }

  // Atendimento em Domicílio
  if (barb.atendimento_domicilio) {
    document.getElementById('divDomicilio').style.display = 'block';
  }

  // Carregar dados complementares
  await carregarDadosPublicos();

  // Ocultar loading e mostrar site
  document.getElementById('loadingView').style.display = 'none';
  document.getElementById('mainView').style.display = 'block';
});

async function carregarDadosPublicos() {
  // Profissionais
  const { data: profs } = await supabase.from('profissionais').select('*').eq('barbearia_id', barbearia.id).eq('ativo', true);
  profissionais = profs || [];
  const selectProf = document.getElementById('agendProfissional');
  profissionais.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    selectProf.appendChild(opt);
  });

  // Serviços
  const { data: servs } = await supabase.from('servicos').select('*').eq('barbearia_id', barbearia.id).eq('ativo', true);
  servicos = servs || [];
  const containerServ = document.getElementById('agendServicos');
  const containerPubServ = document.getElementById('listaServicosPublicos');
  
  if (servicos.length === 0) {
    containerServ.innerHTML = '<p style="font-size: 0.85rem; color: var(--text-muted);">Nenhum serviço disponível.</p>';
    containerPubServ.innerHTML = '<p style="color: var(--text-muted);">Nenhum serviço cadastrado.</p>';
  } else {
    let pubHtml = '';
    servicos.forEach(s => {
      // Checkbox para agendamento
      const div = document.createElement('div');
      div.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.9rem;';
      div.innerHTML = `
        <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; color: var(--text-main);">
          <input type="checkbox" name="servico" value="${s.id}" data-preco="${s.preco}" data-duracao="${s.duracao_minutos}" onchange="atualizarDataMinimaOuHorarios()">
          ${s.nome} (${s.duracao_minutos} min)
        </label>
        <span class="valor" style="color: var(--brand-color);">R$ ${Number(s.preco).toFixed(2)}</span>
      `;
      containerServ.appendChild(div);

      // Lista pública
      pubHtml += `
        <div class="service-item">
          <div>
            <strong>${s.nome}</strong>
            <p style="font-size: 0.8rem; color: var(--text-muted);">${s.duracao_minutos} minutos</p>
          </div>
          <span class="valor" style="font-size: 1.1rem; color: var(--brand-color);">R$ ${Number(s.preco).toFixed(2)}</span>
        </div>
      `;
    });
    containerPubServ.innerHTML = pubHtml;
  }

  // Galeria
  const { data: gal } = await supabase.from('cortes_galeria').select('*, servicos(nome)').eq('barbearia_id', barbearia.id);
  const containerGal = document.getElementById('listaGaleriaPublica');
  if (!gal || gal.length === 0) {
    containerGal.innerHTML = '<p style="color: var(--text-muted);">Nenhuma foto na galeria.</p>';
  } else {
    let galHtml = '<div class="gallery-grid">';
    gal.forEach(g => {
      const servNome = g.servicos ? g.servicos.nome : 'Corte em Destaque';
      galHtml += `
        <div class="gallery-card">
          <img src="${g.foto_url}" alt="Corte">
          <p style="font-size: 0.85rem; font-weight: 600; margin-bottom: 6px;">${servNome}</p>
          <button type="button" class="btn-primary" style="padding: 6px; font-size: 0.8rem;" onclick="selecionarServicoPorGaleria('${g.servico_id}')">Quero este</button>
        </div>
      `;
    });
    galHtml += '</div>';
    containerGal.innerHTML = galHtml;
  }

  // Planos do Clube
  const { data: planos } = await supabase.from('planos_clube').select('*').eq('barbearia_id', barbearia.id).eq('ativo', true);
  if (planos && planos.length > 0) {
    document.getElementById('planosSecao').style.display = 'block';
    const containerPlanos = document.getElementById('listaPlanosPublicos');
    let planoHtml = '';
    planos.forEach(p => {
      const msgPlano = encodeURIComponent(`Olá, tenho interesse em assinar o plano ${p.nome} (R$ ${Number(p.preco).toFixed(2)}) na ${barbearia.nome}. Como proceder?`);
      const linkPlanoZap = `https://wa.me/55${barbearia.whatsapp ? barbearia.whatsapp.replace(/\D/g, '') : ''}?text=${msgPlano}`;
      planoHtml += `
        <div class="plan-item">
          <div>
            <strong>${p.nome}</strong>
            <p style="font-size: 0.85rem; color: var(--text-muted);">${p.descricao || ''}</p>
            <span class="valor" style="color: var(--brand-color); font-size: 1.1rem;">R$ ${Number(p.preco).toFixed(2)}/mês</span>
          </div>
          <a href="${linkPlanoZap}" target="_blank" class="btn-primary" style="width: auto; padding: 8px 14px; font-size: 0.9rem;">Assinar agora</a>
        </div>
      `;
    });
    containerPlanos.innerHTML = planoHtml;
  }

  // Configurar data mínima (hoje + 30 min) e limite de 10 dias
  const inputData = document.getElementById('agendData');
  const hoje = new Date();
  inputData.min = hoje.toISOString().split('T')[0];
  
  const maxData = new Date();
  maxData.setDate(hoje.getDate() + 10);
  inputData.max = maxData.toISOString().split('T')[0];

  inputData.addEventListener('change', calcularHorariosLivres);
  document.getElementById('agendProfissional').addEventListener('change', calcularHorariosLivres);
}

window.selecionarServicoPorGaleria = function(servicoId) {
  if (!servicoId) {
    alert('Este corte não tem um serviço específico vinculado.');
    return;
  }
  const checkboxes = document.querySelectorAll('input[name="servico"]');
  checkboxes.forEach(cb => {
    if (cb.value === servicoId) {
      cb.checked = true;
    }
  });
  document.getElementById('agendamento').scrollIntoView({ behavior: 'smooth' });
  calcularHorariosLivres();
};

window.atualizarDataMinimaOuHorarios = function() {
  calcularHorariosLivres();
};

async function calcularHorariosLivres() {
  const dataSelecionada = document.getElementById('agendData').value;
  const profId = document.getElementById('agendProfissional').value;
  const selectHorario = document.getElementById('agendHorario');
  
  selectHorario.innerHTML = '<option value="">Carregando horários...</option>';

  if (!dataSelecionada) {
    selectHorario.innerHTML = '<option value="">Escolha a data primeiro</option>';
    return;
  }

  // Somar duração dos serviços escolhidos
  const checkboxes = document.querySelectorAll('input[name="servico"]:checked');
  if (checkboxes.length === 0) {
    selectHorario.innerHTML = '<option value="">Selecione pelo menos um serviço</option>';
    return;
  }

  let duracaoTotal = 0;
  checkboxes.forEach(cb => {
    duracaoTotal += Number(cb.getAttribute('data-duracao'));
  });

  const dataObj = new Date(dataSelecionada + 'T00:00:00');
  const diaSemana = dataObj.getDay(); // 0=domingo ... 6=sábado
  const agora = new Date();
  const éHoje = dataSelecionada === agora.toISOString().split('T')[0];

  // Determinar quais profissionais considerar
  let profsAlvo = [];
  if (profId === 'sem_pref') {
    profsAlvo = profissionais;
  } else if (profId) {
    profsAlvo = profissionais.filter(p => p.id === profId);
  } else {
    selectHorario.innerHTML = '<option value="">Selecione um profissional</option>';
    return;
  }

  // Buscar agendamentos já existentes neste dia para os profissionais alvo
  const inicioDia = dataSelecionada + 'T00:00:00';
  const fimDia = dataSelecionada + 'T23:59:59';

  const { data: agendamentosExistentes } = await supabase
    .from('agendamentos')
    .select('*')
    .eq('barbearia_id', barbearia.id)
    .gte('data_hora', inicioDia)
    .lte('data_hora', fimDia)
    .neq('status', 'cancelado');

  let horariosDisponiveis = [];

  for (const prof of profsAlvo) {
    // Verificar se o profissional atende neste dia da semana
    let diasTrab = prof.dias_semana;
    if (typeof diasTrab === 'string') diasTrab = JSON.parse(diasTrab);
    if (diasTrab && !diasTrab.includes(diaSemana)) continue;

    const [hInicio, mInicio] = prof.hora_inicio.split(':').map(Number);
    const [hFim, mFim] = prof.hora_fim.split(':').map(Number);

    let currentMin = hInicio * 60 + mInicio;
    const maxMin = hFim * 60 + mFim;

    while (currentMin + duracaoTotal <= maxMin) {
      const hSlot = Math.floor(currentMin / 60);
      const mSlot = currentMin % 60;
      const horaStr = String(hSlot).padStart(2, '0') + ':' + String(mSlot).padStart(2, '0');
      
      const slotDateTime = new Date(`${dataSelecionada}T${horaStr}:00`);

      // Regra: Hoje só horários com mais de 30 min de antecedência
      if (éHoje) {
        const limiteAntecedencia = new Date(agora.getTime() + 30 * 60000);
        if (slotDateTime <= limiteAntecedencia) {
          currentMin += 30; // avançar de 30 em 30 min
          continue;
        }
      }

      // Verificar conflito de horário para este profissional específico
      const ocupado = (agendamentosExistentes || []).some(ag => {
        if (ag.profissional_id !== prof.id) return false;
        const agInicio = new Date(ag.data_hora).getTime();
        const agFim = agInicio + ag.duracao_total * 60000;
        const slotFim = slotDateTime.getTime() + duracaoTotal * 60000;
        return (slotDateTime.getTime() < agFim && slotFim > agInicio);
      });

      if (!ocupado) {
        const rotuloSlot = `${horaStr} (${prof.nome.split(' ')[0]})`;
        const valorUnicoSlot = `${prof.id}_${dataSelecionada}T${horaStr}:00`;
        
        // Evitar duplicar se for "sem preferência" e múltiplos profissionais tiverem livre
        if (!horariosDisponiveis.some(h => h.hora === horaStr)) {
          horariosDisponiveis.push({ hora: horaStr, valor: valorUnicoSlot, rotulo: rotuloSlot, profId: prof.id });
        }
      }

      currentMin += 30; // Blocos de 30 em 30 minutos
    }
  }

  selectHorario.innerHTML = '';
  if (horariosDisponiveis.length === 0) {
    selectHorario.innerHTML = '<option value="">Nenhum horário livre nesta data</option>';
    return;
  }

  horariosDisponiveis.sort((a, b) => a.hora.localeCompare(b.hora));

  horariosDisponiveis.forEach(h => {
    const opt = document.createElement('option');
    opt.value = h.valor;
    opt.textContent = h.rotulo;
    selectHorario.appendChild(opt);
  });
}

// Submeter Agendamento
document.getElementById('formAgendar').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const checkboxes = document.querySelectorAll('input[name="servico"]:checked');
  if (checkboxes.length === 0) {
    alert('Selecione pelo menos um serviço.');
    return;
  }

  const horarioVal = document.getElementById('agendHorario').value;
  if (!horarioVal) {
    alert('Selecione um horário válido.');
    return;
  }

  const [profId, dataHoraStr] = horarioVal.split('_');
  const clienteNome = document.getElementById('agendNome').value;
  const clienteWhatsapp = document.getElementById('agendWhatsapp').value;
  const local = barbearia.atendimento_domicilio ? document.getElementById('agendLocal').value : 'barbearia';

  let servicoIds = [];
  let valorTotal = 0;
  let duracaoTotal = 0;

  checkboxes.forEach(cb => {
    servicoIds.push(cb.value);
    valorTotal += Number(cb.getAttribute('data-preco'));
    duracaoTotal += Number(cb.getAttribute('data-duracao'));
  });

  let taxaAplicada = 0;
  if (local === 'domicilio') {
    taxaAplicada = Number(barbearia.taxa_domicilio || 0);
    valorTotal += taxaAplicada;
  }

  // Inserir agendamento no Supabase
  const { data, error } = await supabase.from('agendamentos').insert([{
    barbearia_id: barbearia.id,
    profissional_id: profId,
    servico_ids: servicoIds,
    data_hora: dataHoraStr,
    duracao_total: duracaoTotal,
    local: local,
    taxa_aplicada: taxaAplicada,
    valor_total: valorTotal,
    cliente_nome: clienteNome,
    cliente_whatsapp: clienteWhatsapp,
    status: 'pendente'
  }]).select('*, profissionais(nome)').single();

  if (error) {
    if (error.code === '23505' || error.message.includes('conflict') || error.message.includes('duplicate')) {
      alert('Este horário acabou de ser ocupado por outro cliente. Por favor, escolha outro horário.');
      calcularHorariosLivres();
    } else {
      alert('Erro ao realizar agendamento: ' + error.message);
    }
    return;
  }

  // Sucesso: esconder formulário e mostrar botão do WhatsApp
  document.getElementById('formAgendar').style.display = 'none';
  
  const dataHoraObj = new Date(dataHoraStr);
  const dataFmt = dataHoraObj.toLocaleDateString('pt-BR') + ' às ' + dataHoraObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const profNome = data.profissionais ? data.profissionais.nome : 'Profissional';

  const msgZap = encodeURIComponent(`Olá! Sou ${clienteNome}. Acabei de agendar na ${barbearia.nome}:\n- Profissional: ${profNome}\n- Data/Hora: ${dataFmt}\n- Local: ${local === 'domicilio' ? 'Em Domicílio' : 'Na Barbearia'}\n- Total: R$ ${valorTotal.toFixed(2)}\nAguardo confirmação!`);
  const linkZap = `https://wa.me/55${barbearia.whatsapp ? barbearia.whatsapp.replace(/\D/g, '') : ''}?text=${msgZap}`;

  const btnZapLink = document.getElementById('linkEnviarZap');
  btnZapLink.href = linkZap;
  document.getElementById('sucessoAgendamento').style.display = 'block';
});
