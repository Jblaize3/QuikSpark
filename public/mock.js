import express from 'express';
import User from '../models/User.js';

const router = express.Router();

// Add mock portfolio data to a user (for testing)
router.post('/add-mock-portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Mock portfolio items with variety of types
    const mockPortfolio = [
      {
        filename: "AI App Design Mockup",
        url: "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1200",
        uploadedAt: new Date(),
        caption: "Exploring conversational AI interfaces for productivity tools"
      },
      {
        filename: "Product Demo Video",
        url: "https://www.w3schools.com/html/mov_bbb.mp4",
        uploadedAt: new Date(),
        caption: "Early prototype showing core workflow - feedback welcome!"
      },
      {
        filename: "Landing Page Design",
        url: "https://images.unsplash.com/photo-1517292987719-0369a794ec0f?w=1200",
        uploadedAt: new Date(),
        caption: "Conversion-focused design for SaaS startups"
      },
      {
        filename: "Figma Design System",
        url: "https://www.figma.com/community/file/1234567890/design-system",
        uploadedAt: new Date(),
        caption: "Building a scalable component library for rapid prototyping"
      },
      {
        filename: "GitHub Project Repo",
        url: "https://github.com/BuilderDAO/awesome-project",
        uploadedAt: new Date(),
        caption: "Open-source tool for developers - looking for contributors"
      },
      {
        filename: "Mobile App Screens",
        url: "https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=1200",
        uploadedAt: new Date(),
        caption: "Fitness tracking app concept - want to build this for real"
      }
    ];

    const mockWorkTypes = ["prototype", "experiment-mvp", "prototype", "prototype", "open-source", "live-product"];

    // Add mock data using updateOne
    await User.updateOne(
      { _id: userId },
      { 
        $set: { 
          uploadedFiles: mockPortfolio,
          workTypes: mockWorkTypes
        }
      }
    );
    
    // Fetch updated user
    const updatedUser = await User.findById(userId);

    res.json({
      success: true,
      message: 'Mock portfolio data added successfully!',
      itemsAdded: mockPortfolio.length,
      portfolio: updatedUser.uploadedFiles
    });

  } catch (error) {
    console.error('Error adding mock portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add mock portfolio',
      error: error.message
    });
  }
});

// Clear portfolio data (for testing)
router.post('/clear-portfolio/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const user = await User.findById(userId);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.uploadedFiles = [];
    user.workTypes = [];
    await user.save({ validateModifiedOnly: true });

    res.json({
      success: true,
      message: 'Portfolio cleared successfully!'
    });

  } catch (error) {
    console.error('Error clearing portfolio:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clear portfolio',
      error: error.message
    });
  }
});

export default router;