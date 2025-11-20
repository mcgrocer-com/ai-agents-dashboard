/**
 * BloggerCreatePage
 * 9-step wizard for creating AI-powered blog posts
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BlogWizard,
  PersonaSelector,
  TemplateSelector,
  KeywordResearch,
  ContentEditor,
  SeoOptimizer,
  ProductSelector,
  BlogPreview,
} from '@/components/blogger';
import { getAllPersonas } from '@/services/blogger/personas.service';
import { getAllTemplates } from '@/services/blogger/templates.service';
import { researchKeywords, generateMetaData, generateBlogContent, calculateSeoScore, calculateReadabilityScore } from '@/services/blogger/ai.service';
import { searchProducts } from '@/services/blogger/shopify.service';
import { createBlog } from '@/services/blogger/blogs.service';
import { cacheKeyword } from '@/services/blogger/keywords.service';
import type { BloggerPersona, BloggerTemplate, Keyword, ShopifyProduct, BlogWithRelations } from '@/types/blogger';

const TOTAL_STEPS = 9;
const AUTOSAVE_KEY = 'blogger_draft';

export function BloggerCreatePage() {
  const navigate = useNavigate();

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

  // Step 4: Keywords
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<Keyword | null>(null);

  // Step 5: Meta Data
  const [metaTitle, setMetaTitle] = useState('');
  const [metaDescription, setMetaDescription] = useState('');

  // Step 6: Content
  const [content, setContent] = useState('');
  const [markdownContent, setMarkdownContent] = useState('');

  // Step 7: SEO
  const [seoScore, setSeoScore] = useState<number | null>(null);
  const [readabilityScore, setReadabilityScore] = useState<number | null>(null);

  // Step 8: Products
  const [selectedProducts, setSelectedProducts] = useState<ShopifyProduct[]>([]);

  // Load personas and templates on mount
  useEffect(() => {
    loadInitialData();
    loadAutoSave();
  }, []);

  // Auto-save on state changes
  useEffect(() => {
    const timer = setTimeout(() => {
      saveToLocalStorage();
    }, 1000);
    return () => clearTimeout(timer);
  }, [topic, selectedPersona, selectedTemplate, selectedKeyword, metaTitle, metaDescription, content, markdownContent, selectedProducts]);

  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [personasRes, templatesRes] = await Promise.all([
        getAllPersonas(),
        getAllTemplates(),
      ]);

      if (personasRes.success && personasRes.data) {
        setPersonas(personasRes.data);
      }

      if (templatesRes.success && templatesRes.data) {
        setTemplates(templatesRes.data);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
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
      selectedProducts,
      currentStep,
    };
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(draft));
  };

  const loadAutoSave = () => {
    const saved = localStorage.getItem(AUTOSAVE_KEY);
    if (saved) {
      try {
        const draft = JSON.parse(saved);
        setTopic(draft.topic || '');
        setSelectedPersona(draft.selectedPersona || null);
        setSelectedTemplate(draft.selectedTemplate || null);
        setSelectedKeyword(draft.selectedKeyword || null);
        setMetaTitle(draft.metaTitle || '');
        setMetaDescription(draft.metaDescription || '');
        setContent(draft.content || '');
        setMarkdownContent(draft.markdownContent || '');
        setSelectedProducts(draft.selectedProducts || []);
        setCurrentStep(draft.currentStep || 1);
      } catch (error) {
        console.error('Error loading autosave:', error);
      }
    }
  };

  const clearAutoSave = () => {
    localStorage.removeItem(AUTOSAVE_KEY);
  };

  const handleNext = async () => {
    if (currentStep === 4 && keywords.length === 0) {
      // Auto-trigger keyword research
      await handleKeywordResearch(topic);
    } else if (currentStep === 5 && !metaTitle && !metaDescription) {
      // Auto-generate meta data
      await handleGenerateMetaData();
    } else if (currentStep === 6 && !content) {
      // Auto-generate blog content
      await handleGenerateBlog();
    } else if (currentStep === 7) {
      // Calculate SEO scores
      calculateScores();
    } else if (currentStep === TOTAL_STEPS) {
      // Final step: Save blog
      await handleSaveBlog();
      return;
    }

    setCurrentStep((prev) => Math.min(prev + 1, TOTAL_STEPS));
  };

  const handlePrevious = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleKeywordResearch = async (searchTopic: string) => {
    setIsLoading(true);
    try {
      const result = await researchKeywords(searchTopic);
      if (result.success && result.data) {
        setKeywords(result.data.keywords);
        // Cache keywords
        for (const kw of result.data.keywords.slice(0, 5)) {
          await cacheKeyword({ ...kw, topic: searchTopic });
        }
      }
    } catch (error) {
      console.error('Error researching keywords:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateMetaData = async () => {
    if (!selectedKeyword) return;

    setIsLoading(true);
    try {
      const result = await generateMetaData(topic, [selectedKeyword.keyword]);
      if (result.success && result.data) {
        setMetaTitle(result.data.title);
        setMetaDescription(result.data.description);
      }
    } catch (error) {
      console.error('Error generating meta data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGenerateBlog = async () => {
    if (!selectedPersona || !selectedTemplate || !selectedKeyword) return;

    setIsLoading(true);
    try {
      const result = await generateBlogContent({
        topic,
        persona_id: selectedPersona.id,
        template_id: selectedTemplate.id,
        keywords: [selectedKeyword.keyword],
        products: selectedProducts.map(p => p.handle),
      });

      if (result.success && result.data) {
        setContent(result.data.content);
        setMarkdownContent(result.data.markdown || '');
      }
    } catch (error) {
      console.error('Error generating blog:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateScores = () => {
    const seo = calculateSeoScore(content, metaTitle, metaDescription, selectedKeyword?.keyword || '');
    const readability = calculateReadabilityScore(content);
    setSeoScore(seo);
    setReadabilityScore(readability);
  };

  const handleProductSearch = async (query: string): Promise<ShopifyProduct[]> => {
    const result = await searchProducts(query);
    return result.success && result.data ? result.data.products : [];
  };

  const handleSaveBlog = async () => {
    if (!selectedPersona || !selectedTemplate) return;

    setIsLoading(true);
    try {
      const result = await createBlog({
        persona_id: selectedPersona.id,
        template_id: selectedTemplate.id,
        primary_keyword_id: selectedKeyword?.id || null,
        title: metaTitle,
        slug: '',
        content,
        markdown_content: markdownContent,
        meta_title: metaTitle,
        meta_description: metaDescription,
        status: 'draft',
        seo_score: seoScore,
        readability_score: readabilityScore,
        word_count: content.split(/\s+/).length,
      });

      if (result.success) {
        clearAutoSave();
        navigate('/blogger');
      }
    } catch (error) {
      console.error('Error saving blog:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const canGoNext = () => {
    switch (currentStep) {
      case 1: return topic.trim().length > 0;
      case 2: return selectedPersona !== null;
      case 3: return selectedTemplate !== null;
      case 4: return selectedKeyword !== null;
      case 5: return metaTitle.length > 0 && metaDescription.length > 0;
      case 6: return content.length > 0;
      case 7: return true;
      case 8: return true;
      case 9: return true;
      default: return false;
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Enter Blog Topic</h3>
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
          <KeywordResearch
            topic={topic}
            keywords={keywords}
            selectedKeyword={selectedKeyword}
            onResearch={handleKeywordResearch}
            onSelectKeyword={setSelectedKeyword}
            isLoading={isLoading}
          />
        );

      case 5:
        return (
          <SeoOptimizer
            metaTitle={metaTitle}
            metaDescription={metaDescription}
            seoScore={null}
            readabilityScore={null}
            onMetaTitleChange={setMetaTitle}
            onMetaDescriptionChange={setMetaDescription}
            isLoading={isLoading}
          />
        );

      case 6:
        return (
          <ContentEditor
            content={content}
            markdownContent={markdownContent}
            onChange={(html, md) => {
              setContent(html);
              setMarkdownContent(md);
            }}
            isLoading={isLoading}
          />
        );

      case 7:
        return (
          <SeoOptimizer
            metaTitle={metaTitle}
            metaDescription={metaDescription}
            seoScore={seoScore}
            readabilityScore={readabilityScore}
            onMetaTitleChange={setMetaTitle}
            onMetaDescriptionChange={setMetaDescription}
            isLoading={isLoading}
          />
        );

      case 8:
        return (
          <ProductSelector
            selectedProducts={selectedProducts}
            onSearch={handleProductSearch}
            onAddProduct={(product) => setSelectedProducts([...selectedProducts, product])}
            onRemoveProduct={(id) => setSelectedProducts(selectedProducts.filter(p => p.id !== id))}
            isLoading={isLoading}
          />
        );

      case 9:
        const previewBlog: BlogWithRelations = {
          id: 'preview',
          user_id: '',
          persona_id: selectedPersona?.id || '',
          template_id: selectedTemplate?.id || '',
          primary_keyword_id: selectedKeyword?.id || null,
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
          persona: selectedPersona,
          template: selectedTemplate,
          primary_keyword: selectedKeyword,
        };
        return <BlogPreview blog={previewBlog} />;

      default:
        return null;
    }
  };

  return (
    <BlogWizard
      currentStep={currentStep}
      totalSteps={TOTAL_STEPS}
      onNext={handleNext}
      onPrevious={handlePrevious}
      canGoNext={canGoNext()}
      isLoading={isLoading}
    >
      {renderStep()}
    </BlogWizard>
  );
}
