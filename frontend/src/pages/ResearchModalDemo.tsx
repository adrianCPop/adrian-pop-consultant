import { useState } from 'react';
import ResearchModal from '@/components/ResearchModal';
import { Button } from '@/components/ui/button';

const ResearchModalDemo = () => {
  const [modalOpen, setModalOpen] = useState(false);

  // Sample HTML content that would typically come from the research API
  const sampleResearchContent = `
    <h1>Advanced Research: Tax Compliance Analysis</h1>
    <p>This comprehensive analysis examines the impact of recent tax regulation changes on international commerce platforms.</p>
    
    <h2>Executive Summary</h2>
    <p>The United Kingdom has initiated a consultation to explore e-invoicing for business-to-government (B2G) and business-to-business (B2B) transactions, signaling a significant move towards modernizing its fiscal infrastructure and improving compliance.</p>
    
    <h3>Key Findings</h3>
    <ul>
      <li><strong>Digital Transformation:</strong> The shift towards e-invoicing represents a fundamental change in how businesses interact with tax authorities.</li>
      <li><strong>Compliance Benefits:</strong> Automated systems reduce errors and improve audit trails.</li>
      <li><strong>Implementation Challenges:</strong> Businesses need to update their systems and processes.</li>
    </ul>
    
    <blockquote>
      "The modernization of fiscal infrastructure is not just about technology—it's about creating a more transparent and efficient business environment."
    </blockquote>
    
    <h3>Impact Analysis</h3>
    <table>
      <thead>
        <tr>
          <th>Sector</th>
          <th>Impact Level</th>
          <th>Timeline</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>E-commerce</td>
          <td>High</td>
          <td>6-12 months</td>
        </tr>
        <tr>
          <td>Manufacturing</td>
          <td>Medium</td>
          <td>12-18 months</td>
        </tr>
        <tr>
          <td>Services</td>
          <td>Low</td>
          <td>18-24 months</td>
        </tr>
      </tbody>
    </table>
    
    <h3>Recommendations</h3>
    <ol>
      <li>Begin system assessment and planning immediately</li>
      <li>Engage with tax technology providers</li>
      <li>Establish cross-functional implementation teams</li>
    </ol>
    
    <p><em>For more detailed information, consult with your tax advisory team.</em></p>
    
    <hr />
    
    <p><code>Generated: ${new Date().toLocaleString()}</code></p>
  `;

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col items-center justify-center p-8">
      <div className="max-w-2xl text-center space-y-6">
        <h1 className="text-4xl font-bold text-foreground">
          Improved Research Modal Demo
        </h1>
        <p className="text-lg text-muted-foreground">
          This demonstrates the enhanced Advanced Research modal with improved dark mode readability and user-friendly features.
        </p>
        
        <div className="space-y-4">
          <h3 className="text-xl font-semibold text-foreground">New Features:</h3>
          <ul className="text-left space-y-2 text-muted-foreground">
            <li>✅ Optimized for dark theme readability</li>
            <li>✅ Copy to clipboard functionality</li>
            <li>✅ Improved header with icon and better styling</li>
            <li>✅ Enhanced typography and spacing</li>
            <li>✅ Professional table and code styling</li>
            <li>✅ Better modal size and scrolling</li>
          </ul>
        </div>
        
        <Button 
          onClick={() => setModalOpen(true)}
          className="bg-gradient-primary hover:shadow-glow-modern transition-all duration-300 hover:scale-105 px-8 py-3 text-lg"
        >
          Open Research Modal Demo
        </Button>
      </div>

      <ResearchModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        htmlContent={sampleResearchContent}
      />
    </div>
  );
};

export default ResearchModalDemo;