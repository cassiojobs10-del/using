// painel.js - Lógica do Painel Administrativo
let barbeariaId = null;
let barbeariaData = null;

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Verificar autenticação
  const { data: { session }, error } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/entrar.html';
    return;
  }

  const userId = session.user.id;

  // 2. Carregar dados da barbearia do utilizador logado
  const { data: barb, error: barbError } = await supabase
    .from('barbearias')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (barbError || !barb) {
    alert('Nenhuma barbearia encontrada para este utilizador. Certifique-se de que criou o registo no Supabase.');
    return;
  }

  barbeariaId = barb.id;
  barbeariaData = barb;

  // Preencher cabeçalho e formulário de configurações
  document.getElementById('barbeariaNome').textContent = barb.nome;
  document.getElementById('barbeariaSlug').textContent = `Endereço público: /b/${barb.slug}`;
  
  preencherConfigForm(barb);

  // Carregar dados iniciais das abas
  carregarAgenda();
  carregarServicos();
  carregarProfissionais();
  carregarGaleria();
  carregarPlanos();

  // Configurar navegação por abas
  setupTabs();
  
  // Configurar eventos de formulários
  setupForms();
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/entrar.html';
});

function setupTabs() {
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      
      btn.classList.add('active');
      const tabId = 'tab-' + btn.getAttribute('data-tab');
      document.getElementById(tabId).classList.add('active');
    });
  });
}

function preencherConfigForm(barb) {
  document.getElementById('cfgNome').value = barb.nome || '';
  document.getElementById('cfgSlug').value = barb.slug || '';
  document.getElementById('cfgFrase').value = barb.frase || '';
  document.getElementById('cfgLogotipo').value = barb.logotipo || '';
  document.getElementById('cfgCapa').value = barb.capa || '';
  document.getElementById('cfgCor').value = barb.cor || '#C99A4B';
  document.getElementById('cfgSobreTitulo').value = barb.sobre_titulo || '';
  document.getElementById('cfgSobreTexto').value = barb.sobre_texto || '';
  document.getElementById('cfgSobreFoto').value = barb.sobre_foto || '';
  document.getElementById('cfgEndereco').value = barb.endereco || '';
  document.getElementById('cfgHorarioTexto').value = barb.horario_texto || '';
  document.getElementById('cfgTelefone').value = barb.telefone || '';
  document.getElementById('cfgWhatsapp').value = barb.whatsapp || '';
  document.getElementById('cfgInstagram').value = barb.instagram || '';
  document.getElementById('cfgPix').value = barb.pix || '';
  document.getElementById('cfgDomicilio').checked = barb.atendimento_domicilio || false;
  document.getElementById('cfgTaxaDomicilio').value = barb.taxa_domicilio || 0;
}

// --- AGENDA ---
async function carregarAgenda() {
  const filtroProf = document.getElementById('filtroProfissional').value;
  
  let query = supabase
    .from('agendamentos')
    .select('*, profissionais(nome)')
    .eq('barbearia_id', barbeariaId)
    .order('data_hora', { ascending: true });

  if (filtroProf) {
    query = query.eq('profissional_id', filtroProf);
  }

  const { data: agendamentos, error } = await query;
  if (error) {
    console.error('Erro ao carregar agenda:', error);
    return;
  }

  let recebido = 0;
  let aReceber = 0;
  let proximos = 0;
  const agora = new Date();

  const tbody = document.getElementById('listaAgendamentos');
  tbody.innerHTML = '';

  if (!agendamentos || agendamentos.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">Nenhum agendamento encontrado.</td></tr>';
    atualizarEstatisticas(0, 0, 0);
    return;
  }

  agendamentos.forEach(ag => {
    const dataHora = new Date(ag.data_hora);
    const dataFmt = dataHora.toLocaleDateString('pt-BR') + ' ' + dataHora.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    
    if (ag.status === 'pago') {
      recebido += Number(ag.valor_total);
    } else if (ag.status === 'pendente') {
      aReceber += Number(ag.valor_total);
    }

    if (dataHora >= agora && ag.status !== 'cancelado') {
      proximos++;
    }

    const badgeClass = `badge badge-${ag.status}`;
    const profNome = ag.profissionais ? ag.profissionais.nome : 'Sem preferência';

    // Montar mensagem WhatsApp para cobrança
    const msgZap = encodeURIComponent(`Olá ${ag.cliente_nome}, aqui é da ${barbeariaData.nome}. Passando para lembrar do seu agendamento em ${dataFmt}. O valor total é R$ ${Number(ag.valor_total).toFixed(2)}. Chave Pix para pagamento: ${barbeariaData.pix || 'Consulte'}`);
    const linkZap = `https://wa.me/55${ag.cliente_whatsapp.replace(/\D/g, '')}?text=${msgZap}`;

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${dataFmt}</td>
      <td><strong>${ag.cliente_nome}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${ag.cliente_whatsapp}</span></td>
      <td>Prof: ${profNome}<br><span style="font-size:0.8rem; color:var(--text-muted);">Local: ${ag.local}</span></td>
      <td class="valor">R$ ${Number(ag.valor_total).toFixed(2)}</td>
      <td><span class="${badgeClass}">${ag.status}</span></td>
      <td>
        <div class="action-btns">
          ${ag.status === 'pendente' ? `<button class="btn-sm btn-success" onclick="mudarStatusAgendamento('${ag.id}', 'pago')">Pagar</button>` : ''}
          ${ag.status !== 'cancelado' ? `<button class="btn-sm btn-danger" onclick="mudarStatusAgendamento('${ag.id}', 'cancelado')">Cancelar</button>` : ''}
          <a href="${linkZap}" target="_blank" class="btn-sm btn-whatsapp" title="Cobrar no WhatsApp">Zap</a>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  atualizarEstatisticas(recebido, aReceber, proximos);
  carregarFiltroProfissionais();
}

function atualizarEstatisticas(recebido, aReceber, proximos) {
  document.getElementById('statRecebido').textContent = `R$ ${recebido.toFixed(2)}`;
  document.getElementById('statAReceber').textContent = `R$ ${aReceber.toFixed(2)}`;
  document.getElementById('statProximos').textContent = proximos;
}

async function carregarFiltroProfissionais() {
  const { data: profs } = await supabase.from('profissionais').select('id, nome').eq('barbearia_id', barbeariaId);
  const select = document.getElementById('filtroProfissional');
  const valorAtual = select.value;
  select.innerHTML = '<option value="">Todos os profissionais</option>';
  if (profs) {
    profs.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.id;
      opt.textContent = p.nome;
      if (p.id === valorAtual) opt.selected = true;
      select.appendChild(opt);
    });
  }
}

document.getElementById('filtroProfissional').addEventListener('change', carregarAgenda);

window.mudarStatusAgendamento = async function(id, novoStatus) {
  const { error } = await supabase.from('agendamentos').update({ status: novoStatus }).eq('id', id);
  if (error) {
    alert('Erro ao atualizar status: ' + error.message);
  } else {
    carregarAgenda();
  }
};

// --- SERVIÇOS ---
async function carregarServicos() {
  const { data: servicos } = await supabase.from('servicos').select('*').eq('barbearia_id', barbeariaId);
  const container = document.getElementById('listaServicos');
  const selectGaleria = document.getElementById('galeriaServico');
  
  container.innerHTML = '';
  selectGaleria.innerHTML = '<option value="">Nenhum serviço vinculado</option>';

  if (!servicos || servicos.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">Nenhum serviço cadastrado.</p>';
    return;
  }

  let html = '<table><thead><tr><th>Nome</th><th>Preço</th><th>Duração</th><th>Ações</th></tr></thead><tbody>';
  servicos.forEach(s => {
    html += `
      <tr>
        <td>${s.nome}</td>
        <td class="valor">R$ ${Number(s.preco).toFixed(2)}</td>
        <td>${s.duracao_minutos} min</td>
        <td><button class="btn-sm btn-danger" onclick="removerServico('${s.id}')">Excluir</button></td>
      </tr>
    `;
    const opt = document.createElement('option');
    opt.value = s.id;
    opt.textContent = s.nome;
    selectGaleria.appendChild(opt);
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

window.removerServico = async function(id) {
  if (confirm('Deseja excluir este serviço?')) {
    await supabase.from('servicos').delete().eq('id', id);
    carregarServicos();
  }
};

// --- EQUIPE ---
async function carregarProfissionais() {
  const { data: profs } = await supabase.from('profissionais').select('*').eq('barbearia_id', barbeariaId);
  const container = document.getElementById('listaProfissionais');
  container.innerHTML = '';

  if (!profs || profs.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">Nenhum profissional cadastrado.</p>';
    return;
  }

  let html = '<table><thead><tr><th>Nome</th><th>Expediente</th><th>Ações</th></tr></thead><tbody>';
  profs.forEach(p => {
    html += `
      <tr>
        <td>${p.nome}</td>
        <td class="mono">${p.hora_inicio} às ${p.hora_fim}</td>
        <td><button class="btn-sm btn-danger" onclick="removerProfissional('${p.id}')">Excluir</button></td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

window.removerProfissional = async function(id) {
  if (confirm('Deseja excluir este profissional?')) {
    await supabase.from('profissionais').delete().eq('id', id);
    carregarProfissionais();
    carregarAgenda();
  }
};

// --- GALERIA ---
async function carregarGaleria() {
  const { data: fotos } = await supabase.from('cortes_galeria').select('*, servicos(nome)').eq('barbearia_id', barbeariaId);
  const container = document.getElementById('listaGaleria');
  container.innerHTML = '';

  if (!fotos || fotos.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">Nenhuma foto na galeria.</p>';
    return;
  }

  let html = '<div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">';
  fotos.forEach(f => {
    const servNome = f.servicos ? f.servicos.nome : 'Sem vínculo';
    html += `
      <div style="background: var(--bg-main); border: 1px solid var(--border-color); border-radius: 8px; overflow: hidden; padding: 8px;">
        <img src="${f.foto_url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 6px;">
        <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 6px;">Serviço: ${servNome}</p>
        <button class="btn-sm btn-danger" style="width: 100%;" onclick="removerGaleria('${f.id}')">Excluir</button>
      </div>
    `;
  });
  html += '</div>';
  container.innerHTML = html;
}

window.removerGaleria = async function(id) {
  if (confirm('Deseja excluir esta foto?')) {
    await supabase.from('cortes_galeria').delete().eq('id', id);
    carregarGaleria();
  }
};

// --- PLANOS ---
async function carregarPlanos() {
  const { data: planos } = await supabase.from('planos_clube').select('*').eq('barbearia_id', barbeariaId);
  const container = document.getElementById('listaPlanos');
  container.innerHTML = '';

  if (!planos || planos.length === 0) {
    container.innerHTML = '<p style="color: var(--text-muted);">Nenhum plano cadastrado.</p>';
    return;
  }

  let html = '<table><thead><tr><th>Plano</th><th>Preço</th><th>Ações</th></tr></thead><tbody>';
  planos.forEach(p => {
    html += `
      <tr>
        <td><strong>${p.nome}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${p.descricao || ''}</span></td>
        <td class="valor">R$ ${Number(p.preco).toFixed(2)}</td>
        <td><button class="btn-sm btn-danger" onclick="removerPlano('${p.id}')">Excluir</button></td>
      </tr>
    `;
  });
  html += '</tbody></table>';
  container.innerHTML = html;
}

window.removerPlano = async function(id) {
  if (confirm('Deseja excluir este plano?')) {
    await supabase.from('planos_clube').delete().eq('id', id);
    carregarPlanos();
  }
};

// --- FORMULÁRIOS DE CADASTRO E CONFIGURAÇÃO ---
function setupForms() {
  document.getElementById('formServico').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('servicoNome').value;
    const preco = document.getElementById('servicoPreco').value;
    const duracao_minutos = document.getElementById('servicoDuracao').value;

    const { error } = await supabase.from('servicos').insert([{ barbearia_id: barbeariaId, nome, preco, duracao_minutos }]);
    if (error) alert('Erro: ' + error.message);
    else {
      document.getElementById('formServico').reset();
      carregarServicos();
    }
  });

  document.getElementById('formProfissional').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('profNome').value;
    const hora_inicio = document.getElementById('profInicio').value;
    const hora_fim = document.getElementById('profFim').value;

    const { error } = await supabase.from('profissionais').insert([{ barbearia_id: barbeariaId, nome, hora_inicio, hora_fim }]);
    if (error) alert('Erro: ' + error.message);
    else {
      document.getElementById('formProfissional').reset();
      carregarProfissionais();
      carregarAgenda();
    }
  });

  document.getElementById('formGaleria').addEventListener('submit', async (e) => {
    e.preventDefault();
    const foto_url = document.getElementById('galeriaFoto').value;
    const servico_id = document.getElementById('galeriaServico').value || null;

    const { error } = await supabase.from('cortes_galeria').insert([{ barbearia_id: barbeariaId, foto_url, servico_id }]);
    if (error) alert('Erro: ' + error.message);
    else {
      document.getElementById('formGaleria').reset();
      carregarGaleria();
    }
  });

  document.getElementById('formPlano').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nome = document.getElementById('planoNome').value;
    const descricao = document.getElementById('planoDesc').value;
    const preco = document.getElementById('planoPreco').value;

    const { error } = await supabase.from('planos_clube').insert([{ barbearia_id: barbeariaId, nome, descricao, preco }]);
    if (error) alert('Erro: ' + error.message);
    else {
      document.getElementById('formPlano').reset();
      carregarPlanos();
    }
  });

  document.getElementById('formConfig').addEventListener('submit', async (e) => {
    e.preventDefault();
    const updates = {
      nome: document.getElementById('cfgNome').value,
      slug: document.getElementById('cfgSlug').value,
      frase: document.getElementById('cfgFrase').value,
      logotipo: document.getElementById('cfgLogotipo').value,
      capa: document.getElementById('cfgCapa').value,
      cor: document.getElementById('cfgCor').value,
      sobre_titulo: document.getElementById('cfgSobreTitulo').value,
      sobre_texto: document.getElementById('cfgSobreTexto').value,
      sobre_foto: document.getElementById('cfgSobreFoto').value,
      endereco: document.getElementById('cfgEndereco').value,
      horario_texto: document.getElementById('cfgHorarioTexto').value,
      telefone: document.getElementById('cfgTelefone').value,
      whatsapp: document.getElementById('cfgWhatsapp').value,
      instagram: document.getElementById('cfgInstagram').value,
      pix: document.getElementById('cfgPix').value,
      atendimento_domicilio: document.getElementById('cfgDomicilio').checked,
      taxa_domicilio: document.getElementById('cfgTaxaDomicilio').value
    };

    const { error } = await supabase.from('barbearias').update(updates).eq('id', barbeariaId);
    if (error) alert('Erro ao atualizar: ' + error.message);
    else {
      alert('Configurações salvas com sucesso!');
      document.getElementById('barbeariaNome').textContent = updates.nome;
      document.getElementById('barbeariaSlug').textContent = `Endereço público: /b/${updates.slug}`;
    }
  });
}
