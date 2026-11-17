// Shared with the AI chatbot knowledge base (ai-service/data/knowledge_base.json) in spirit; keep them in sync.
export const FAQ_ITEMS = [
  ['How do I sell my waste?', 'Log in, open Sell Waste, upload a photo of each type of waste, confirm the AI-suggested category, enter an approximate weight, then choose your address, date and time slot. Nearby verified collectors are notified and one accepts.'],
  ['How is the scrap price calculated?', 'Indicative price = estimated weight × the current admin-managed rate per kg. The final amount uses the weight the collector verifies at your doorstep, and you confirm it before the transaction completes.'],
  ['Do collectors see my address and phone number?', 'Not until they accept. Before acceptance they only see your locality, materials, estimated weight and an approximate distance.'],
  ['How do I list a used product?', 'Go to Sell Used Products, add photos and details, and use the AI to get a reuse/repair/donate/recycle suggestion, a price range and a draft description. Edit anything, then publish.'],
  ['When is a marketplace order complete?', 'Only after the seller accepts your request and confirms the handover. A purchase request alone never completes an order.'],
  ['How do I become a kabadiwala on ReCircle?', 'Use Become a Kabadiwala to register with your business details, ID proof, service area and working hours. An admin verifies your details before you receive requests.'],
  ['What are eco-reward points?', 'Points earned for verified activity: per kg of recyclables collected and for each product sold or bought second-hand.'],
  ['Which waste is not accepted?', 'Wet/food waste, medical waste, chemicals, paint and other hazardous materials are not collected.'],
  ['Is the AI always right?', 'No. Every AI result shows a confidence score and you can change the category, price or recommendation. Without vision API credentials the classifier runs in a clearly labelled demo mode.'],
  ['How do I pay or get paid?', 'For scrap, the collector pays you by cash/UPI after weighing. For products, pay the seller at handover, or online via Razorpay test mode if it is enabled.'],
];
