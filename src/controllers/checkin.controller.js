const checkinService = require('../services/checkin.service');

/**
 * Controller responsável pelos endpoints de Check-in e Check-out do Kids9.
 */
class CheckinController {
  /**
   * Endpoint para criar um check-in.
   * POST /api/checkins
   */
  async create(req, res) {
    try {
      const { childName, parentPhone, paymentMethod, paymentValue, playtimeMinutes, shopping } = req.body;

      // Validação rápida de campos obrigatórios
      if (!childName || !parentPhone || !paymentMethod || paymentValue === undefined || !playtimeMinutes) {
        return res.status(400).json({ 
          error: 'Parâmetros obrigatórios ausentes. Verifique se enviou childName, parentPhone, paymentMethod, paymentValue e playtimeMinutes.' 
        });
      }

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
   * Endpoint para realizar o check-out.
   * POST /api/checkins/:id/checkout
   */
  async checkout(req, res) {
    try {
      const { id } = req.params;
      const { pin, isAdminOverride, adminPin } = req.body;

      if (!id) {
        return res.status(400).json({ error: 'ID do registro é obrigatório.' });
      }

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
   * Endpoint para listar check-ins ativos (Painel do Administrador / Painel Público).
   * GET /api/checkins/active
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
   * Endpoint para obter os detalhes de um check-in por ID.
   * GET /api/checkins/:id
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
   * Endpoint para obter o histórico de check-ins.
   * GET /api/checkins/history
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
   * Endpoint para obter estatísticas do painel administrativo.
   * GET /api/checkins/stats
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
