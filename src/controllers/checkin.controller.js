/**
 * @file checkin.controller.js
 * @description Controller responsável por receber as requisições HTTP, validar os parâmetros
 * de entrada e mapear as respostas da API para as operações de check-in e check-out do Kids9.
 */

const checkinService = require('../services/checkin.service');

class CheckinController {
  /**
   * Cria um novo registro de check-in (entrada da criança).
   * 
   * @route POST /api/checkins
   * @async
   * @param {import('express').Request} req Requisição Express contendo os dados da criança no corpo (body)
   * @param {import('express').Response} res Resposta Express utilizada para retornar JSON
   * @returns {Promise<import('express').Response>} Retorna status 201 e dados do check-in ou 400 se faltar campo obrigatório
   */
  async create(req, res) {
    try {
      const { childName, parentPhone, paymentMethod, paymentValue, playtimeMinutes, shopping } = req.body;

      // Validação de presença obrigatória de dados básicos no payload de entrada
      if (!childName || !parentPhone || !paymentMethod || paymentValue === undefined || !playtimeMinutes) {
        return res.status(400).json({ 
          error: 'Parâmetros obrigatórios ausentes. Verifique se enviou childName, parentPhone, paymentMethod, paymentValue e playtimeMinutes.' 
        });
      }

      // Invocar a camada de serviço de negócio
      const checkin = await checkinService.createCheckin({
        childName,
        parentPhone,
        paymentMethod,
        paymentValue,
        playtimeMinutes,
        shopping
      });

      return res.status(201).json({
        message: 'Check-in registrado com sucesso! O PIN de segurança foi disparado para o responsável.',
        data: checkin
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao registrar check-in:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor ao registrar check-in.' 
      });
    }
  }

  /**
   * Finaliza um registro de check-in existente (saída da criança).
   * 
   * @route POST /api/checkins/:id/checkout
   * @async
   * @param {import('express').Request} req Requisição Express contendo o ID em params e o PIN no corpo (body)
   * @param {import('express').Response} res Resposta Express
   * @returns {Promise<import('express').Response>} Retorna status 200 e dados do check-in atualizado ou 400 se houver erro
   */
  async checkout(req, res) {
    try {
      const { id } = req.params;
      const { pin, isAdminOverride, adminPin } = req.body;

      // Validar a presença obrigatória do parâmetro ID de rota
      if (!id) {
        return res.status(400).json({ error: 'ID do registro é obrigatório.' });
      }

      // Executar regra de saída na camada de serviço
      const updatedCheckin = await checkinService.checkout(id, {
        pin,
        isAdminOverride: !!isAdminOverride,
        adminPin
      });

      return res.status(200).json({
        message: 'Check-out finalizado com sucesso! Criança liberada.',
        data: updatedCheckin
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao finalizar check-out:', error);
      return res.status(400).json({ 
        error: error.message || 'Erro ao processar o check-out.' 
      });
    }
  }

  /**
   * Lista todos os check-ins ativos (crianças que estão brincando no momento).
   * 
   * @route GET /api/checkins/active
   * @async
   * @param {import('express').Request} req Requisição Express
   * @param {import('express').Response} res Resposta Express
   * @returns {Promise<import('express').Response>} Retorna status 200 e a lista com contagem
   */
  async listActive(req, res) {
    try {
      const activeCheckins = await checkinService.getActiveCheckins();
      return res.status(200).json({
        count: activeCheckins.length,
        data: activeCheckins
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao listar check-ins ativos:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor ao recuperar check-ins ativos.' 
      });
    }
  }

  /**
   * Busca os detalhes de um check-in específico a partir do seu ID.
   * 
   * @route GET /api/checkins/:id
   * @async
   * @param {import('express').Request} req Requisição Express contendo o ID em params
   * @param {import('express').Response} res Resposta Express
   * @returns {Promise<import('express').Response>} Retorna status 200 e dados do registro ou 404 se não encontrado
   */
  async getById(req, res) {
    try {
      const { id } = req.params;
      const checkin = await checkinService.getCheckinById(id);

      if (!checkin) {
        return res.status(404).json({ error: 'Registro de check-in não encontrado.' });
      }

      return res.status(200).json({
        data: checkin
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao buscar check-in por ID:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor ao buscar detalhes.' 
      });
    }
  }

  /**
   * Obtém o histórico completo de check-ins recentes.
   * Rota protegida. Exige autorização administrativa por PIN no header.
   * 
   * @route GET /api/checkins/history
   * @async
   * @param {import('express').Request} req Requisição Express
   * @param {import('express').Response} res Resposta Express
   * @returns {Promise<import('express').Response>} Retorna status 200 e histórico limitado a 100 itens
   */
  async getHistory(req, res) {
    try {
      const history = await checkinService.getHistoryCheckins();
      return res.status(200).json({
        count: history.length,
        data: history
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao obter histórico:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor ao obter histórico.' 
      });
    }
  }

  /**
   * Obtém consolidados estatísticos do dashboard administrativo (KPIs e ocupação horária).
   * Rota protegida. Exige autorização administrativa por PIN no header.
   * 
   * @route GET /api/checkins/stats
   * @async
   * @param {import('express').Request} req Requisição Express
   * @param {import('express').Response} res Resposta Express
   * @returns {Promise<import('express').Response>} Retorna status 200 e objeto estruturado de métricas
   */
  async getStats(req, res) {
    try {
      const stats = await checkinService.getDashboardStats();
      return res.status(200).json({
        data: stats
      });
    } catch (error) {
      console.error('[CHECKIN-CONTROLLER] Erro ao obter estatísticas:', error);
      return res.status(500).json({ 
        error: 'Erro interno do servidor ao obter estatísticas.' 
      });
    }
  }
}

module.exports = new CheckinController();
