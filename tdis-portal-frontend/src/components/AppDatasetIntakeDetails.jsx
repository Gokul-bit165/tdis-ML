/**
 * @fileoverview Application/Datasets Intake Form Component
 *
 * This component provides a comprehensive form for submitting application and datasets
 * intake requests to the TDIS (Texas Data Infrastructure Service) API. It features:
 *
 * - Animated UI elements using Framer Motion
 * - Form validation with real-time feedback
 * - Date picker with business logic constraints
 * - API integration with error handling
 * - Responsive design for mobile and desktop
 * - Auto-navigation after successful submission
 *
 * The form collects information about:
 * - Request type (application or datasets)
 * - Agency details and contact information
 * - Project description and user personas
 * - Funding status and timeline
 * - Data format requirements
 *
 * @author TDIS Portal Team
 * @version 1.0.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const MotionSection = motion.section;
const MotionDiv = motion.div;
const MotionImg = motion.img;
const MotionForm = motion.form;
const MotionH2 = motion.h2;
const MotionButton = motion.button;
const MotionP = motion.p;
import { format, isBefore, startOfToday } from 'date-fns';
import { CalendarIcon } from 'lucide-react';

// Services
import {
  submitIntakeForm,
  validateIntakeForm,
  formatDateForAPI,
} from '../services/intakeService.js';
import { trackEvent, DATASET_INTAKE } from '../utils/googleAnalytics.js';

// UI Components
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

import { cn } from '@/lib/utils';

/**
 * Animation variants for the container element
 * @constant {Object}
 */
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.2,
    },
  },
};

/**
 * Animation variants for individual items
 * @constant {Object}
 */
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * Animation variants for buttons
 * @constant {Object}
 */
/**
 * Animation variants for form sections
 * @constant {Object}
 */
const formSectionVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

/**
 * Animation variants for form fields
 * @constant {Object}
 */
const formFieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 24,
    },
  },
};

/**
 * AppDatasetIntakeDetails Component
 *
 * A React component that renders a detailed form for application/datasets intake process.
 * It includes animated elements, form validation, and various UI components for data input.
 *
 * Features:
 * - Animated form sections and fields
 * - Date picker with validation
 * - Radio button selection
 * - Dropdown selection
 * - Responsive design
 * - Form validation
 * - Navigation capabilities
 * - API integration
 *
 * @component
 * @returns {JSX.Element} Rendered component
 *
 * @example
 * ```jsx
 * <AppDatasetIntakeDetails />
 * ```
 */
const AppDatasetIntakeDetails = () => {
  const navigate = useNavigate();

  // Form state
  const [date, setDate] = React.useState(null);
  const [requestType, setRequestType] = React.useState('application');
  const [funding, setFunding] = React.useState('funded');

  // Form data state
  const [formData, setFormData] = React.useState({
    agencyName: '',
    agencyContactName: '',
    agencyContactEmail: '',
    description: '',
    personas: '',
    dataInputsFormats: '',
    estimatedFileSize: '',
    nativeDataFormats: '',
  });

  // UI state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [validationErrors, setValidationErrors] = React.useState([]);
  const [submitStatus, setSubmitStatus] = React.useState(null); // 'success' | 'error' | null

  /**
   * Handle form field changes
   * @param {string} field - Field name
   * @param {string} value - Field value
   */
  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));

    // Clear validation errors when user starts typing
    if (validationErrors.length > 0) {
      setValidationErrors([]);
    }
  };

  /**
   * Handles form submission
   * @param {React.FormEvent} event - The form submission event
   */
  const handleSubmit = async (event) => {
    event.preventDefault();

    // Reset status
    setSubmitStatus(null);
    setValidationErrors([]);

    // Prepare complete form data
    const completeFormData = {
      ...formData,
      requestType,
      funding,
      dateNeededBy: formatDateForAPI(date),
    };

    // Validate form
    const validation = validateIntakeForm(completeFormData);
    if (!validation.isValid) {
      setValidationErrors(validation.errors);
      return;
    }

    // Submit form
    setIsSubmitting(true);
    try {
      const result = await submitIntakeForm(completeFormData);

      if (result.success) {
        trackEvent(DATASET_INTAKE, DATASET_INTAKE, {
          tab: 'home',
          action: 'submit_success',
          event_label: 'submit_success',
          request_type: requestType,
        });
        setSubmitStatus('success');
        // Scroll to show success message
        setTimeout(() => {
          const successElement = document.querySelector('[data-success-message]');
          if (successElement) {
            successElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // Reset form and navigate back to home after successful submission
        setTimeout(() => {
          setFormData({
            agencyName: '',
            agencyContactName: '',
            agencyContactEmail: '',
            description: '',
            personas: '',
            dataInputsFormats: '',
            estimatedFileSize: '',
            nativeDataFormats: '',
          });
          setDate(null);
          setRequestType('application');
          setFunding('funded');
          setSubmitStatus(null);
          // Navigate back to home page
          navigate('/');
        }, 3000);
      } else {
        setSubmitStatus('error');
        setValidationErrors([result.error]);
        // Scroll to show error message
        setTimeout(() => {
          const errorElement = document.querySelector('[data-error-message]');
          if (errorElement) {
            errorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);

        // Auto-hide error message after 5 seconds
        setTimeout(() => {
          setSubmitStatus(null);
          setValidationErrors([]);
        }, 5000);
      }
    } catch {
      setSubmitStatus('error');
      setValidationErrors(['An unexpected error occurred. Please try again.']);
      // Auto-hide error message after 5 seconds
      setTimeout(() => {
        setSubmitStatus(null);
        setValidationErrors([]);
      }, 5000);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <MotionSection
      className="py-16 px-4 sm:px-6 md:px-8 bg-[#F0F3F4] h-full"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      aria-label="Application and Datasets Submission Form"
    >
      <div className="mx-auto max-w-6xl">
        {/* Header Section */}
        <MotionDiv
          className="flex items-center gap-10 mb-10"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.5 }}
        >
          <MotionButton
            type="button"
            onClick={() => navigate('/')}
            className="cursor-pointer p-0 border-0 bg-transparent"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            aria-label="Navigate back to home page"
          >
            <img src="/back-icon.svg" alt="" className="pointer-events-none" />
          </MotionButton>
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-[#324755]">
            Application/Datasets
          </h1>
        </MotionDiv>

        {/* Process Description */}
        <MotionP
          className="text-center text-[28px] text-[#324755] mb-5"
          initial={{ y: -20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 0.5 }}
        >
          Process of Application/Datasets In-Take:
        </MotionP>

        {/* Process Image */}
        <MotionImg
          src="/application_dataset_intake_process.png.webp"
          alt="Application/Datasets In-Take Process Flow Diagram"
          className="w-full max-h-[932px] h-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ amount: 0.3 }}
          transition={{ duration: 0.5 }}
        />

        {/* Form Section */}
        <MotionForm
          onSubmit={handleSubmit}
          className="mt-10"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ amount: 0.3 }}
        >
          <MotionH2
            className="text-[28px] text-[#324755] mb-5 font-semibold"
            variants={itemVariants}
          >
            Application / Datasets In-take Form:
          </MotionH2>

          <MotionP className="text-[#324755] text-[20px]" variants={itemVariants}>
            Fields marked with an * are required
          </MotionP>

          {/* Validation Errors */}
          {validationErrors.length > 0 && (
            <MotionDiv
              className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              data-error-message
            >
              <h3 className="text-red-800 font-semibold mb-2">Please fix the following errors:</h3>
              <ul className="list-disc list-inside text-red-700">
                {validationErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </MotionDiv>
          )}

          {/* Success Message */}
          {submitStatus === 'success' && (
            <MotionDiv
              className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              data-success-message
            >
              <h3 className="text-green-800 font-semibold">Form submitted successfully!</h3>
              <p className="text-green-700">
                Thank you for your submission. We will review your request and get back to you soon.
              </p>
              <p className="text-green-600 text-sm mt-2">
                Redirecting to home page in 3 seconds...
              </p>
            </MotionDiv>
          )}

          <MotionDiv
            className="flex gap-6 mt-5"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-1/2" variants={formFieldVariants}>
              <Label htmlFor="requestType" className="text-[#324755]">
                Select request type
              </Label>
              <Select value={requestType} onValueChange={setRequestType}>
                <SelectTrigger className="w-full min-h-[44px] h-[44px] bg-white border-input">
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="application">Application</SelectItem>
                  <SelectItem value="datasets">Datasets</SelectItem>
                </SelectContent>
              </Select>
            </MotionDiv>

            <MotionDiv className="flex flex-col gap-2 w-1/2" variants={formFieldVariants}>
              <Label htmlFor="agencyName" className="text-[#324755]">
                Agency name*
              </Label>
              <Input
                type="text"
                id="agencyName"
                placeholder="Enter agency name"
                className="bg-white h-11"
                value={formData.agencyName}
                onChange={(e) => handleFieldChange('agencyName', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="flex gap-6 mt-6"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-1/2" variants={formFieldVariants}>
              <Label htmlFor="agencyContactName" className="text-[#324755]">
                Agency contact name*
              </Label>
              <Input
                type="text"
                id="agencyContactName"
                placeholder="Enter agency contact name"
                className="bg-white h-11"
                value={formData.agencyContactName}
                onChange={(e) => handleFieldChange('agencyContactName', e.target.value)}
              />
            </MotionDiv>

            <MotionDiv className="flex flex-col gap-2 w-1/2" variants={formFieldVariants}>
              <Label htmlFor="agencyContactEmail" className="text-[#324755]">
                Agency contact email*
              </Label>
              <Input
                type="email"
                id="agencyContactEmail"
                placeholder="Enter agency contact email"
                className="bg-white h-11"
                value={formData.agencyContactEmail}
                onChange={(e) => handleFieldChange('agencyContactEmail', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col gap-2 w-full mt-6"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-full" variants={formFieldVariants}>
              <Label htmlFor="description" className="text-[#324755]">
                Brief description of the Application / Datasets *
              </Label>
              <Textarea
                id="description"
                placeholder="Enter brief description of the Application / Datasets"
                className="bg-white h-28"
                value={formData.description}
                onChange={(e) => handleFieldChange('description', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col gap-2 w-full mt-6"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-full" variants={formFieldVariants}>
              <Label htmlFor="personas" className="text-[#324755]">
                End user(s) personas *
              </Label>
              <Textarea
                id="personas"
                placeholder="Enter end user(s) personas"
                className="bg-white h-28"
                value={formData.personas}
                onChange={(e) => handleFieldChange('personas', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col gap-2 w-full mt-6"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <Label htmlFor="funding" className="text-[#324755]">
              Select one *
            </Label>
            <RadioGroup
              value={funding}
              onValueChange={setFunding}
              className="flex items-center gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="funded" id="funded" />
                <Label htmlFor="funded">Funded</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="not-funded" id="not-funded" />
                <Label htmlFor="not-funded">Not funded</Label>
              </div>
            </RadioGroup>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-5"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-full sm:w-1/2" variants={formFieldVariants}>
              <Label htmlFor="dateNeededBy" className="text-[#324755]">
                Date needed by *
              </Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={'outline'}
                    className={cn(
                      'w-full justify-start text-left font-normal h-11 bg-white',
                      !date && 'text-muted-foreground'
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, 'PPP') : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                    disabled={(date) => isBefore(date, startOfToday())}
                  />
                </PopoverContent>
              </Popover>
            </MotionDiv>

            <MotionDiv className="flex flex-col gap-2 w-full sm:w-1/2" variants={formFieldVariants}>
              <Label htmlFor="dataInputsFormats" className="text-[#324755]">
                Data Inputs formats *
              </Label>
              <Input
                type="text"
                id="dataInputsFormats"
                placeholder="Enter data inputs formats"
                className="bg-white h-11"
                value={formData.dataInputsFormats}
                onChange={(e) => handleFieldChange('dataInputsFormats', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-5"
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
          >
            <MotionDiv className="flex flex-col gap-2 w-full sm:w-1/2" variants={formFieldVariants}>
              <Label htmlFor="estimatedFileSize" className="text-[#324755]">
                Estimated file size
              </Label>
              <Input
                type="text"
                id="estimatedFileSize"
                placeholder="Enter estimated file size"
                className="bg-white h-11"
                value={formData.estimatedFileSize}
                onChange={(e) => handleFieldChange('estimatedFileSize', e.target.value)}
              />
            </MotionDiv>
            <MotionDiv className="flex flex-col gap-2 w-full sm:w-1/2" variants={formFieldVariants}>
              <Label htmlFor="nativeDataFormats" className="text-[#324755]">
                Native Data formats
              </Label>
              <Input
                type="text"
                id="nativeDataFormats"
                placeholder="Enter native data formats"
                className="bg-white h-11"
                value={formData.nativeDataFormats}
                onChange={(e) => handleFieldChange('nativeDataFormats', e.target.value)}
              />
            </MotionDiv>
          </MotionDiv>

          <MotionDiv
            variants={formSectionVariants}
            initial="hidden"
            whileInView="visible"
            viewport={{ amount: 0.3 }}
            className="mt-5"
          >
            <MotionButton
              type="submit"
              disabled={isSubmitting}
              className={cn(
                'px-12 py-2 rounded-lg font-bold cursor-pointer transition-all',
                isSubmitting
                  ? 'bg-gray-400 text-white cursor-not-allowed'
                  : 'bg-[#324755] text-white hover:shadow-lg hover:shadow-[#324755]/20'
              )}
              variants={formFieldVariants}
              whileHover={
                !isSubmitting
                  ? {
                      scale: 1.05,
                      backgroundColor: '#2A3B45',
                      transition: { duration: 0.2 },
                    }
                  : {}
              }
              whileTap={!isSubmitting ? { scale: 0.95 } : {}}
              transition={{ type: 'spring', stiffness: 400, damping: 10 }}
            >
              {isSubmitting ? 'Submitting...' : 'Submit'}
            </MotionButton>
          </MotionDiv>
        </MotionForm>
      </div>
    </MotionSection>
  );
};

export default AppDatasetIntakeDetails;
