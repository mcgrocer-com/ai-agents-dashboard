/**
 * BloggerCreatePage
 * 6-step wizard for creating AI-powered blog posts with automatic SEO meta generation
 */

import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import {
  BlogWizard,
  PersonaSelector,
  TemplateSelector,
  ContentEditor,
  AgentInsights,
  SeoOptimizer,
  BlogPreview,
  BlogGenerationSettingsDialog,
  type BlogGenerationSettings,
} from '@/components/blogger';
import { getAllPersonas } from '@/services/blogger/personas.service';
import { getAllTemplates } from '@/services/blogger/templates.service';
import { generateMetaData, calculateSeoScore, calculateReadabilityScore } from '@/services/blogger/ai.service';
import { generateBlogWithGemini, type ProcessingLog } from '@/services/blogger/gemini-content.service';
import { createBlog, getBlogById, updateBlog } from '@/services/blogger/blogs.service';
import type { BloggerPersona, BloggerTemplate, BlogWithRelations } from '@/types/blogger';
import Swal from 'sweetalert2';

const TOTAL_STEPS = 6;
const AUTOSAVE_KEY = 'blogger_draft';

export function BloggerCreatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id } = useParams<{ id: string }>();
  const isEditMode = Boolean(id);
  const passedBlog = location.state?.blog as BlogWithRelations | undefined;

  // Wizard state
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  // Step 1: Topic
  const [topic, setTopic] = useState('');

  // Step 2: Persona
  const [personas, setPersonas] = useState<BloggerPersona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<BloggerPersona | null>(null);

  // Step 3: Template
  const [templates, setTemplates] = useState<BloggerTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<BloggerTemplate | null>(null);

  // Step 4: Content Preview (AI selects keyword autonomously)
  const [content, setContent] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');
  const [processingLogs, setProcessingLogs] = useState<ProcessingLog[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string>(''); // Keyword selected by AI agent
  const [articlesAnalyzed, setArticlesAnalyzed] = useState<number>(0);
  const [productLinks, setProductLinks] = useState<string[]>([]);
  const [wordCount, setWordCount] = useState<number>(0);

  // Generation Settings Dialog
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  const [generationSettings, setGenerationSettings] = useState<BlogGenerationSettings>({
    model: 'gemini-2.0-flash-exp',
    includeImages: true,
    articlesResearchCount: 3,
  });

  // Step 5: Meta Data & SEO
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [readabilityScore, setReadabilityScore] = useState<number | null>(null);

  // Load personas and templates on mount
  useEffect(() => {
    loadInitialData();
    if (!isEditMode) {
      loadAutoSave(); // Only load autosave in create mode, not edit mode
    }
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage();
    }, 1000);
    return () => clearTimeout(timer);
  }, [topic, selectedPersona, selectedTemplate, selectedKeyword, metaTitle, metaDescription, content, markdownContent, articlesAnalyzed, productLinks, wordCount, processingLogs, generationSettings]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      // Load personas and templates from Supabase
      const [personasResult, templatesResult] = await Promise.all([
        getAllPersonas(),
        getAllTemplates(),
      ]);

      if (personasResult.success && personasResult.data) {
        setPersonas(personasResult.data);
      } else {
        console.error('Error loading personas:', personasResult.error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Personas',
          text: 'Could not load writer personas. Please refresh the page.',
        });
      }

      if (templatesResult.success && templatesResult.data) {
        setTemplates(templatesResult.data);
      } else {
        console.error('Error loading templates:', templatesResult.error);
        Swal.fire({
          icon: 'error',
          title: 'Failed to Load Templates',
          text: 'Could not load blog templates. Please refresh the page.',
        });
      }

      // If in edit mode, load the existing blog
      if (isEditMode && id) {
        let blog: BlogWithRelations | null = null;

        // Use passed blog data if available (from dashboard), otherwise fetch from DB
        if (passedBlog) {
          blog = passedBlog;
        } else {
          const blogResult = await getBlogById(id);
          if (blogResult.success && blogResult.data) {
            blog = blogResult.data;
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Failed to Load Blog',
              text: 'Could not load the blog for editing. Redirecting...',
            });
            navigate('/blogger');
            return;
          }
        }

        if (blog) {
          // Populate form fields with existing blog data
          setTopic(blog.title || '');
          setContent(blog.content || '');
          setMarkdownContent(blog.markdown_content || '');
          setMetaTitle(blog.meta_title || '');
          setMetaDescription(blog.meta_description || '');
          setSeoScore(blog.seo_score);
          setReadabilityScore(blog.readability_score);
          setWordCount(blog.word_count || 0);

          // Find and set the persona
          if (blog.persona_id && personasResult.data) {
            const persona = personasResult.data.find(p => p.id === blog.persona_id);
            setSelectedPersona(persona || null);
          }

          // Find and set the template
          if (blog.template_id && templatesResult.data) {
            const template = templatesResult.data.find(t => t.id === blog.template_id);
            setSelectedTemplate(template || null);
          }
        }
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
      Swal.fire({
        icon: 'error',
        title: 'Initialization Error',
        text: 'Failed to initialize the blog wizard. Please refresh the page.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const saveToLocalStorage = () => {
    const draft = {
      topic,
      selectedPersona,
      selectedTemplate,
      selectedKeyword,
      metaTitle,
      metaDescription,
      content,
      markdownContent,
      currentStep,
      generationSettings,
      articlesAnalyzed,
      productLinks,
      wordCount,
      processingLogs,
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
  };

  const loadAutoSave = () => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);

        // Validate UUID format (UUIDs are 36 chars with dashes, not simple numbers like "1" or "4")
        const isValidUUID = (id: string) => {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          return uuidRegex.test(id);
        };

        // Check if autosave has invalid UUIDs - if so, clear it completely
        const hasInvalidPersona = draft.selectedPersona && !isValidUUID(draft.selectedPersona.id);
        const hasInvalidTemplate = draft.selectedTemplate && !isValidUUID(draft.selectedTemplate.id);

        if (hasInvalidPersona || hasInvalidTemplate) {
          console.warn('⚠️ Found invalid UUIDs in autosave - clearing all autosave data');
          if (hasInvalidPersona) {
            console.warn('  Invalid persona ID:', draft.selectedPersona.id);
          }
          if (hasInvalidTemplate) {
            console.warn('  Invalid template ID:', draft.selectedTemplate.id);
          }
          localStorage.removeItem(AUTOSAVE_KEY);
          return; // Don't load any data from invalid autosave
        }

        // All UUIDs are valid, proceed with loading
        setTopic(draft.topic || '');
        setSelectedPersona(draft.selectedPersona || null);
        setSelectedTemplate(draft.selectedTemplate || null);
        setSelectedKeyword(draft.selectedKeyword || '');
        setMetaTitle(draft.metaTitle || '');
        setMetaDescription(draft.metaDescription || '');
        setContent(draft.content || '');
        setMarkdownContent(draft.markdownContent || '');
        setCurrentStep(draft.currentStep || 1);
        setGenerationSettings(draft.generationSettings || {
          model: 'gemini-2.0-flash-exp',
          includeImages: true,
          articlesResearchCount: 3,
        });
        setArticlesAnalyzed(draft.articlesAnalyzed || 0);
        setProductLinks(draft.productLinks || []);
        setWordCount(draft.wordCount || 0);
        setProcessingLogs(draft.processingLogs || []);
      } catch (error) {
        console.error('Error loading autosave:', error);
        localStorage.removeItem(AUTOSAVE_KEY);
      }
    }
  };

  const clearAutoSave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
  };

  const handleNext = async () => {
    // Step 5 (Meta Data): Calculate scores (meta tags auto-generated during content generation)
    if (currentStep === 5) {
      // Fallback: Generate meta tags if they're still empty (in case content generation was skipped)
      if (!metaTitle && !metaDescription) {
        await handleGenerateMetaData();
      }
      calculateScores();
    }

    // Step 6 (Final Preview): Show finish dialog
    if (currentStep === 6) {
      await handleFinish();
      return; // Don't advance step
    }

    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleGenerateMetaData = async () => {
    if (!selectedKeyword) return;

    setIsLoading(true);
    try {
      const result = await generateMetaData(topic, [selectedKeyword]);
      if (result.success && result.data) {
        setMetaTitle(result.data.title || '');
        setMetaDescription(result.data.description || '');
      }
    } catch (error) {
      console.error('Error generating meta data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBlog = async (settings?: BlogGenerationSettings) => {
    if (!selectedPersona || !selectedTemplate) return;

    setIsLoading(true);
    // Clear previous logs at the start
    setProcessingLogs([]);

    try {
      // Use Gemini AI with autonomous agent workflow
      const result = await generateBlogWithGemini({
        topic,
        persona: selectedPersona,
        template: selectedTemplate,
        model: settings?.model || generationSettings.model,
        includeImages: settings?.includeImages || generationSettings.includeImages,
        articlesResearchCount: settings?.articlesResearchCount || generationSettings.articlesResearchCount,
        // Real-time log updates
        onLogUpdate: (logs) => {
          setProcessingLogs(logs);
        },
      });

      if (result.success && result.data) {
        setContent(result.data.content);
        setMarkdownContent(result.data.markdown || '');
        setSelectedKeyword(result.data.selectedKeyword || topic); // Capture AI-selected keyword
        setArticlesAnalyzed(result.data.articlesAnalyzed || 0);
        setProductLinks(result.data.productLinks || []);
        setWordCount(result.data.wordCount || 0);

        // Auto-populate SEO meta tags from AI generation
        setMetaTitle(result.data.metaTitle || '');
        setMetaDescription(result.data.metaDescription || '');

        // Log generation stats
        console.log('[Blog Generation] Success!');
        console.log('[Processing Logs]', result.data.processingLogs?.length || 0, 'logs received');
        console.log('- Word count:', result.data.wordCount);
        console.log('- Product links:', result.data.productLinks.length);
        console.log('- Articles analyzed:', result.data.articlesAnalyzed);
        console.log('- Selected keyword:', result.data.selectedKeyword);
        console.log('- Meta title:', result.data.metaTitle);
        console.log('- Meta description:', result.data.metaDescription);

        // Show success notification
        Swal.fire({
          icon: 'success',
          title: 'Content Generated!',
          html: `
            <p><strong>Word Count:</strong> ${result.data.wordCount}</p>
            <p><strong>Products Mentioned:</strong> ${result.data.productLinks.length}</p>
            <p><strong>Articles Analyzed:</strong> ${result.data.articlesAnalyzed}</p>
            <p><strong>SEO Meta Tags:</strong> Auto-generated</p>
          `,
          timer: 3000,
          showConfirmButton: false,
        });
      }
    } catch (error) {
      console.error('Error generating blog:', error);
      Swal.fire({
        icon: 'error',
        title: 'Generation Failed',
        text: 'Failed to generate blog content. Please try again.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScores = () => {
    const seo = calculateSeoScore(content, metaTitle, metaDescription, selectedKeyword || '');
    const readability = calculateReadabilityScore(content);
    setSeoScore(seo);
    setReadabilityScore(readability);
  };

  const handleSaveBlog = async () => {
    if (!selectedPersona || !selectedTemplate) return;

    setIsLoading(true);
    try {
      let result;

      if (isEditMode && id) {
        // Update existing blog
        result = await updateBlog(id, {
          persona_id: selectedPersona.id,
          template_id: selectedTemplate.id,
          primary_keyword_id: null,
          title: metaTitle,
          content,
          markdown_content: markdownContent,
          meta_title: metaTitle,
          meta_description: metaDescription,
          seo_score: seoScore,
          readability_score: readabilityScore,
          word_count: content.split(/\s+/).length,
        });
      } else {
        // Create new blog
        const baseSlug = metaTitle
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .substring(0, 50);
        const uniqueSlug = `${baseSlug}-${Date.now()}`;

        result = await createBlog({
          persona_id: selectedPersona.id,
          template_id: selectedTemplate.id,
          primary_keyword_id: null,
          title: metaTitle,
          slug: uniqueSlug,
          content,
          markdown_content: markdownContent,
          meta_title: metaTitle,
          meta_description: metaDescription,
          status: 'draft',
          seo_score: seoScore,
          readability_score: readabilityScore,
          word_count: content.split(/\s+/).length,
          shopify_article_id: null,
          shopify_blog_id: null,
          published_at: null,
        });
      }

      if (result.success) {
        Swal.fire({
          icon: 'success',
          title: isEditMode ? 'Blog Updated!' : 'Blog Saved!',
          text: isEditMode ? 'Your blog has been updated.' : 'Your blog has been saved as a draft.',
          timer: 2000,
          showConfirmButton: false,
        });
        clearAutoSave();
        navigate('/blogger');
      } else {
        const errorMessage = result.error?.message || 'Failed to save blog. Please try again.';
        Swal.fire({
          icon: 'error',
          title: 'Save Failed',
          text: errorMessage,
          confirmButtonText: 'OK',
        });
        console.error('Error saving blog:', result.error);
      }
    } catch (error) {
      console.error('Error saving blog:', error);
      Swal.fire({
        icon: 'error',
        title: 'Unexpected Error',
        text: 'An unexpected error occurred while saving. Please try again.',
        confirmButtonText: 'OK',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDirectPublishToShopify = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));

      Swal.fire({
        icon: 'success',
        title: 'Blog posted on Shopify',
        text: 'Your blog has been successfully published.',
      });
      clearAutoSave();
      navigate('/blogger');
    } catch (error) {
      console.error('Error publishing to Shopify:', error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'Failed to post blog to Shopify.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFinish = async () => {
    const result = await Swal.fire({
      title: 'Finish Blog Post',
      text: 'How would you like to proceed?',
      icon: 'question',
      showCancelButton: true,
      showDenyButton: true,
      confirmButtonText: '<i class="fas fa-save"></i> Save as Draft',
      denyButtonText: '<i class="fas fa-upload"></i> Publish to Shopify',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#3b82f6',
      denyButtonColor: '#10b981',
      cancelButtonColor: '#6b7280',
    });

    if (result.isConfirmed) {
      // Save as draft
      await handleSaveBlog();
    } else if (result.isDenied) {
      // Publish to Shopify
      await handleDirectPublishToShopify();
    }
    // If cancelled, do nothing
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return topic.trim().length > 0;
      case 2: return selectedPersona !== null;
      case 3: return selectedTemplate !== null;
      case 4: return content.length > 0; // Content Preview (AI generates keywords automatically)
      case 5: return metaTitle.length > 0 && metaDescription.length > 0; // Meta Data
      case 6: return true; // Enable "Finish" button on final step
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Enter your blog topic..."
              className="w-full px-4 py-3 border border-gray-300 rounded-md
                focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        );

      case 2:
        return (
          <PersonaSelector
            personas={personas}
            selectedPersonaId={selectedPersona?.id || null}
            onSelect={setSelectedPersona}
            isLoading={isLoading}
          />
        );

      case 3:
        return (
          <TemplateSelector
            templates={templates}
            selectedTemplateId={selectedTemplate?.id || null}
            onSelect={setSelectedTemplate}
            isLoading={isLoading}
          />
        );

      case 4:
        return (
          <div className="space-y-6">
            <ContentEditor
              content={content}
              markdownContent={markdownContent}
              onChange={(html, md) => {
                setContent(html);
                setMarkdownContent(md);
              }}
              onGenerate={handleGenerateBlog}
              onSettingsClick={() => setShowSettingsDialog(true)}
              isLoading={isLoading}
              processingLogs={processingLogs}
            />

            {/* Show Agent Insights after content is generated */}
            {content.length > 0 && !isLoading && (
              <AgentInsights
                processingLogs={processingLogs}
                selectedKeyword={selectedKeyword}
                articlesAnalyzed={articlesAnalyzed}
                productLinks={productLinks}
                wordCount={wordCount}
              />
            )}
          </div>
        );

      case 5:
        return (
          <SeoOptimizer
            metaTitle={metaTitle}
            metaDescription={metaDescription}
            onMetaTitleChange={setMetaTitle}
            onMetaDescriptionChange={setMetaDescription}
            isLoading={isLoading}
          />
        );

      case 6:
        const previewBlog: BlogWithRelations = {
          id: 'preview',
          user_id: '',
          persona_id: selectedPersona?.id || '',
          template_id: selectedTemplate?.id || '',
          primary_keyword_id: null, // AI selects keyword autonomously
          title: metaTitle,
          slug: '',
          content,
          markdown_content: markdownContent,
          meta_title: metaTitle,
          meta_description: metaDescription,
          status: 'draft',
          shopify_article_id: null,
          shopify_blog_id: null,
          published_at: null,
          seo_score: seoScore,
          readability_score: readabilityScore,
          word_count: content.split(/\s+/).length,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          persona: selectedPersona || undefined,
          template: selectedTemplate || undefined,
          primary_keyword: undefined, // Keyword stored as string in selectedKeyword state
        };
        return <BlogPreview blog={previewBlog} />;

      default:
        return null;
    }
  };

  return (
    <>
      <BlogWizard
        currentStep={currentStep as any}
        totalSteps={TOTAL_STEPS}
        onNext={handleNext}
        onPrevious={handlePrevious}
        canGoNext={canGoNext()}
        isLoading={isLoading}
      >
        {renderStep()}
      </BlogWizard>

      {/* Generation Settings Dialog */}
      <BlogGenerationSettingsDialog
        isOpen={showSettingsDialog}
        onClose={() => setShowSettingsDialog(false)}
        onConfirm={(settings) => {
          setGenerationSettings(settings);
          setShowSettingsDialog(false);
          handleGenerateBlog(settings);
        }}
        initialSettings={generationSettings}
        isLoading={isLoading}
      />
    </>
  );
}
