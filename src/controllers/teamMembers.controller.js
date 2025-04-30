const TeamMember = require('../models/TeamMember');

// @desc    Obtenir tous les membres de l'équipe
// @route   GET /api/team-members
// @access  Private
exports.getTeamMembers = async (req, res) => {
  try {
    const teamMembers = await TeamMember.find().sort({ lastName: 1, firstName: 1 });
    
    res.status(200).json({
      success: true,
      count: teamMembers.length,
      data: teamMembers
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des membres de l\'équipe'
    });
  }
};

// @desc    Obtenir un membre de l'équipe par son ID
// @route   GET /api/team-members/:id
// @access  Private
exports.getTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre de l\'équipe non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      data: teamMember
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du membre de l\'équipe'
    });
  }
};

// @desc    Créer un nouveau membre de l'équipe
// @route   POST /api/team-members
// @access  Private (Admin)
exports.createTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.create(req.body);
    
    res.status(201).json({
      success: true,
      data: teamMember
    });
  } catch (error) {
    console.error(error);
    
    // Gestion des erreurs de validation MongoDB
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    // Gestion des erreurs de duplication (email unique)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé par un autre membre de l\'équipe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du membre de l\'équipe'
    });
  }
};

// @desc    Mettre à jour un membre de l'équipe
// @route   PUT /api/team-members/:id
// @access  Private (Admin)
exports.updateTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );
    
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre de l\'équipe non trouvé'
      });
    }
    
    res.status(200).json({
      success: true,
      data: teamMember
    });
  } catch (error) {
    console.error(error);
    
    // Gestion des erreurs de validation MongoDB
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(val => val.message);
      return res.status(400).json({
        success: false,
        message: messages.join(', ')
      });
    }
    
    // Gestion des erreurs de duplication (email unique)
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà utilisé par un autre membre de l\'équipe'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du membre de l\'équipe'
    });
  }
};

// @desc    Supprimer un membre de l'équipe
// @route   DELETE /api/team-members/:id
// @access  Private (Admin)
exports.deleteTeamMember = async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre de l\'équipe non trouvé'
      });
    }
    
    await teamMember.deleteOne();
    
    res.status(200).json({
      success: true,
      data: {}
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du membre de l\'équipe'
    });
  }
};

// @desc    Activer/désactiver un membre de l'équipe
// @route   PATCH /api/team-members/:id/toggle-status
// @access  Private (Admin)
exports.toggleTeamMemberStatus = async (req, res) => {
  try {
    const teamMember = await TeamMember.findById(req.params.id);
    
    if (!teamMember) {
      return res.status(404).json({
        success: false,
        message: 'Membre de l\'équipe non trouvé'
      });
    }
    
    teamMember.active = !teamMember.active;
    await teamMember.save();
    
    res.status(200).json({
      success: true,
      data: teamMember
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du statut du membre de l\'équipe'
    });
  }
};
