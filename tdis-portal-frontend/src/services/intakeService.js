/**
 * Service for handling application/datasets intake form submissions
 * Handles form validation, data formatting, and API communication with TDIS backend
 */

const API_BASE_URL = (() => {
  let s = (import.meta.env.VITE_TDIS_HELPDESK_API_URL || '').trim();
  while (s.endsWith('/')) s = s.slice(0, -1);
  return s;
})();
const API_KEY = import.meta.env.VITE_TDIS_API_KEY;

/**
 * Submit intake form data to the TDIS API
 * @param {Object} formData - The form data to submit
 * @param {string} formData.requestType - "application" or "datasets"
 * @param {string} formData.agencyName - Name of the requesting agency
 * @param {string} formData.agencyContactName - Contact person name
 * @param {string} formData.agencyContactEmail - Contact email address
 * @param {string} formData.description - Brief description of the request
 * @param {string} formData.personas - End user personas description
 * @param {string} formData.funding - "funded" or "not-funded"
 * @param {string} formData.dateNeededBy - Date in MM-DD-YYYY format
 * @param {string} formData.dataInputsFormats - Input data formats
 * @param {string} [formData.estimatedFileSize] - Optional file size estimate
 * @param {string} [formData.nativeDataFormats] - Optional output data formats
 * @returns {Promise<Object>} - API response with success status and data/error
 */
export const submitIntakeForm = async (formData) => {
  try {
    // Validate required fields before submission
    const requiredFields = [
      'agencyName',
      'agencyContactName',
      'agencyContactEmail',
      'description',
      'personas',
      'funding',
      'dateNeededBy',
      'dataInputsFormats',
    ];

    const missingFields = requiredFields.filter((field) => !formData[field]);
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
    }

    // Format request body to match TDIS API field specifications
    // Field names include timestamps and must match exactly
    const requestBody = {
      select_request_type_1723468767869: formData.requestType,
      estimated_file_size_1723451107441: formData.estimatedFileSize || '100MB',
      agency_name_1717755330398: formData.agencyName,
      agency_contact_name_1718354518065: formData.agencyContactName,
      agency_contact_email_1718354565735: formData.agencyContactEmail,
      brief_description_of_the_application_1717755363955: formData.description,
      end_user_s_personas_1717755384353: formData.personas,
      select_one_1717755404504: formData.funding, // API expects "funded" or "not-funded"
      date_needed_by_1717755443106: formData.dateNeededBy,
      data_inputs_formats_1717755521913: formData.dataInputsFormats,
      data_output_formats_1717755544582: formData.nativeDataFormats || 'json',
      submit_1717755595315: '',
    };

    // Make API request
    const response = await fetch(`${API_BASE_URL}/create/opportunity`, {
      method: 'POST',
      headers: {
        Authorization: API_KEY,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    // Handle API response
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API request failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();

    return {
      success: true,
      data: result,
    };
  } catch (error) {
    // Handle different types of errors with appropriate user messages
    if (error.message.includes('CORS') || error.message.includes('Failed to fetch')) {
      return {
        success: false,
        error:
          'Network error: Unable to connect to the server. Please try again or contact support.',
      };
    }

    if (error.message.includes('fund_type') || error.message.includes('funding')) {
      return {
        success: false,
        error: 'Invalid funding status. Please select a valid funding option and try again.',
      };
    }

    return {
      success: false,
      error: error.message || 'An unexpected error occurred. Please try again.',
    };
  }
};

/**
 * Validate form data before submission
 * @param {Object} formData - The form data to validate
 * @returns {Object} - Validation result with isValid boolean and errors array
 */
export const validateIntakeForm = (formData) => {
  const errors = [];

  // Required field validation
  if (!formData.agencyName?.trim()) {
    errors.push('Agency name is required');
  }

  if (!formData.agencyContactName?.trim()) {
    errors.push('Agency contact name is required');
  }

  if (!formData.agencyContactEmail?.trim()) {
    errors.push('Agency contact email is required');
  } else if (!isValidEmail(formData.agencyContactEmail)) {
    errors.push('Please enter a valid email address');
  }

  if (!formData.description?.trim()) {
    errors.push('Brief description is required');
  }

  if (!formData.personas?.trim()) {
    errors.push('End user personas is required');
  }

  if (!formData.funding) {
    errors.push('Please select funding status');
  }

  if (!formData.dateNeededBy) {
    errors.push('Date needed by is required');
  }

  if (!formData.dataInputsFormats?.trim()) {
    errors.push('Data inputs formats is required');
  }

  // Validate enum values
  if (!['application', 'datasets'].includes(formData.requestType)) {
    errors.push('Request type must be either "application" or "datasets"');
  }

  if (!['funded', 'not-funded'].includes(formData.funding)) {
    errors.push('Funding status must be either "Funded" or "not-funded"');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
};

/**
 * Validate email format without regex to avoid ReDoS (S5852).
 * Validates: one @, non-empty local part (no spaces), domain with at least one dot and TLD.
 * @param {string} email - Email to validate
 * @returns {boolean} - Whether email is valid
 */
const isValidEmail = (email) => {
  if (typeof email !== 'string') return false;
  const s = email.trim();
  if (s.length === 0 || s.length > 254) return false;
  const atIndex = s.indexOf('@');
  if (atIndex <= 0 || atIndex !== s.lastIndexOf('@')) return false;
  const local = s.slice(0, atIndex);
  const domain = s.slice(atIndex + 1);
  if (local.includes(' ') || domain.length === 0) return false;
  const dotIndex = domain.lastIndexOf('.');
  return dotIndex > 0 && dotIndex !== domain.length - 1;
};

/**
 * Format date for API submission
 * @param {Date} date - Date object
 * @returns {string} - Formatted date string (MM-DD-YYYY)
 */
export const formatDateForAPI = (date) => {
  if (!date) return '';

  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const year = date.getFullYear();

  return `${month}-${day}-${year}`;
};
