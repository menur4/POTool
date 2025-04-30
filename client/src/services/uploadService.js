import axios from 'axios';

const API_URL = 'http://localhost:3002/api/upload';

/**
 * Upload une image au serveur
 * @param {File} file - Le fichier image à uploader
 * @returns {Promise} - Une promesse qui résout avec les données de réponse
 */
export const uploadPhoto = async (file) => {
  const formData = new FormData();
  formData.append('photo', file);
  
  try {
    const response = await axios.post(`${API_URL}/photo`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      withCredentials: true
    });
    
    return response;
  } catch (error) {
    throw error.response?.data || error;
  }
};

/**
 * Supprime une image du serveur
 * @param {string} filename - Le nom du fichier à supprimer
 * @returns {Promise} - Une promesse qui résout avec les données de réponse
 */
export const deletePhoto = async (filename) => {
  try {
    const response = await axios.delete(`${API_URL}/photo/${filename}`, {
      withCredentials: true
    });
    
    return response;
  } catch (error) {
    throw error.response?.data || error;
  }
};
