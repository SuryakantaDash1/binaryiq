/**
 * Idempotent seed (upsert by natural key) — safe to re-run on any environment.
 * Seeds reference/config data only: 14 profile categories, the Daily Spin game
 * + 8 weighted segments (probabilities sum to 1.0000), the rewards catalogue,
 * and one super-admin. No member data, no ledger rows.
 * See docs/modules/module-00-foundation.md §4.3.
 */
import { PrismaClient, Prisma } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

interface CategoryDef { key: string; name: string; points: number; sort: number; schema: object }

// Shared country list for "born in" style questions. value === label to keep responses readable.
const COUNTRY_NAMES = [
  'India', 'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda',
  'Argentina', 'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain',
  'Bangladesh', 'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso',
  'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Chile', 'China', 'Colombia', 'Costa Rica',
  'Croatia', 'Cuba', 'Cyprus', 'Czech Republic', 'Denmark', 'Ecuador', 'Egypt', 'El Salvador',
  'Estonia', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Georgia', 'Germany', 'Ghana', 'Greece',
  'Guatemala', 'Honduras', 'Hong Kong', 'Hungary', 'Iceland', 'Indonesia', 'Iran', 'Iraq',
  'Ireland', 'Israel', 'Italy', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kuwait',
  'Latvia', 'Lebanon', 'Lithuania', 'Luxembourg', 'Malaysia', 'Maldives', 'Malta', 'Mauritius',
  'Mexico', 'Monaco', 'Mongolia', 'Morocco', 'Myanmar', 'Nepal', 'Netherlands', 'New Zealand',
  'Nigeria', 'North Korea', 'Norway', 'Oman', 'Pakistan', 'Panama', 'Peru', 'Philippines',
  'Poland', 'Portugal', 'Qatar', 'Romania', 'Russia', 'Saudi Arabia', 'Serbia', 'Singapore',
  'Slovakia', 'Slovenia', 'South Africa', 'South Korea', 'Spain', 'Sri Lanka', 'Sweden',
  'Switzerland', 'Syria', 'Taiwan', 'Tanzania', 'Thailand', 'Tunisia', 'Turkey', 'Uganda',
  'Ukraine', 'United Arab Emirates', 'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe', 'Other',
];
const countryOptions = (): Array<{ value: string; label: string }> =>
  COUNTRY_NAMES.map((c) => ({ value: c, label: c }));

const PROFILE_CATEGORIES: CategoryDef[] = [
  {
    key: 'about_you', name: 'About You', points: 100, sort: 1,
    schema: { version: 1, questions: [
      { key: 'address_line1', type: 'text', label: 'Address line 1', required: false },
      { key: 'city', type: 'text', label: 'City', required: true },
      { key: 'pin_code', type: 'text', label: 'PIN / Postal code', required: true },
      { key: 'area_type', type: 'radio', label: 'Area type', required: true, options: [{ value: 'URBAN', label: 'Urban' }, { value: 'RURAL', label: 'Rural' }, { value: 'SUBURBAN', label: 'Suburban' }] },
      { key: 'education_level', type: 'select', label: 'Highest education', required: true, options: [{ value: 'secondary', label: 'Secondary' }, { value: 'graduate', label: 'Graduate' }, { value: 'postgrad', label: 'Post-graduate' }, { value: 'other', label: 'Other' }] },
      { key: 'employment_type', type: 'select', label: 'Employment status', required: true, options: [{ value: 'salaried', label: 'Salaried' }, { value: 'self_employed', label: 'Self-employed' }, { value: 'student', label: 'Student' }, { value: 'homemaker', label: 'Homemaker' }, { value: 'retired', label: 'Retired' }, { value: 'unemployed', label: 'Unemployed' }] },
    ]},
  },
  {
    key: 'home_and_family', name: 'Home and Family', points: 100, sort: 2,
    schema: { version: 1,
      intro: 'Home is where the heart is! Please take 2-3 minutes to complete this brief survey about your home and family. Your responses will help us find surveys that are relevant to your interests and increase your chances of qualifying.',
      questions: [
      { key: 'country_born', type: 'select', label: 'What country were you born in?', required: true, options: countryOptions() },
      { key: 'mother_born', type: 'select', label: 'Where was your mother born?', required: true, options: countryOptions() },
      { key: 'father_born', type: 'select', label: 'Where was your father born?', required: true, options: countryOptions() },
      { key: 'marital_status', type: 'radio', label: 'What is your marital status?', required: true, options: [{ value: 'single', label: 'Single' }, { value: 'married_partner', label: 'Married / Live with partner' }, { value: 'divorced_widowed', label: 'Divorced/Widowed' }] },
      { key: 'main_earner', type: 'radio', label: 'Are you the main salary-earner in your household?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'monthly_income', type: 'select', label: 'What is your individual monthly net income? (after tax)', required: true, options: [
        { value: 'lt_5000', label: 'Less than Rs 5,000' }, { value: '5000_9999', label: 'Rs 5,000 to Rs 9,999' },
        { value: '10000_14999', label: 'Rs 10,000 to Rs 14,999' }, { value: '15000_19999', label: 'Rs 15,000 to Rs 19,999' },
        { value: '20000_24999', label: 'Rs 20,000 to Rs 24,999' }, { value: '25000_29999', label: 'Rs 25,000 to Rs 29,999' },
        { value: '30000_34999', label: 'Rs 30,000 to Rs 34,999' }, { value: '35000_49999', label: 'Rs 35,000 to Rs 49,999' },
        { value: '50000_74999', label: 'Rs 50,000 to Rs 74,999' }, { value: '75000_99999', label: 'Rs 75,000 to Rs 99,999' },
        { value: 'gte_100000', label: 'Rs 100,000 or more' }, { value: 'prefer_not', label: 'Prefer not to answer' },
      ] },
      { key: 'pregnant', type: 'radio', label: 'Are you or your partner currently pregnant?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'population', type: 'radio', label: 'What is the population of the city/town/village you live in?', required: true, options: [
        { value: 'lt_2000', label: 'Less than 2.000 inhabitants' }, { value: '2000_4999', label: '2.000 to 4.999 inhabitants' },
        { value: '5000_19999', label: '5.000 to 19.999 inhabitants' }, { value: '20000_49999', label: '20.000 to 49.999 inhabitants' },
        { value: '50000_99999', label: '50.000 to 99.999 inhabitants' }, { value: '100000_499999', label: '100.000 to 499.999 inhabitants' },
        { value: 'over_500000', label: 'Over 500000 inhabitants' }, { value: 'dont_know', label: "Don't know" },
      ] },
      { key: 'home_ownership', type: 'radio', label: 'Do you rent or own your home?', required: true, options: [
        { value: 'own_apartment', label: 'Own an apartment/condominium' }, { value: 'own_home', label: 'Own my own home' },
        { value: 'rent_apartment', label: 'Rent an apartment/condominium' }, { value: 'rent_house', label: 'Rent a house' },
        { value: 'neither', label: 'Neither own nor rent' },
      ] },
      { key: 'ride_sharing', type: 'multiselect', label: 'Which of the following ride sharing companies have you used in the last 12 months?', required: true, options: [
        { value: 'blablacar', label: 'BlaBlaCar' }, { value: 'blacklane', label: 'Blacklane' }, { value: 'ola', label: 'Ola' },
        { value: 'talixo', label: 'Talixo' }, { value: 'uber', label: 'Uber' }, { value: 'other', label: 'Other' },
        { value: 'none', label: 'I do not use ride sharing services', exclusive: true },
      ] },
      { key: 'survey_languages', type: 'multiselect', label: 'What languages do you feel comfortable taking surveys in?', required: true, options: [
        { value: 'bengali', label: 'Bengali' }, { value: 'gujarati', label: 'Gujarati' }, { value: 'hindi', label: 'Hindi' },
        { value: 'kannada', label: 'Kannada' }, { value: 'marathi', label: 'Marathi' }, { value: 'tamil', label: 'Tamil' },
        { value: 'none', label: 'None of these', exclusive: true },
      ] },
      { key: 'gender_identity', type: 'radio', label: 'When thinking about your gender, which of the following terms do you use to self-identify?', required: true, options: [
        { value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }, { value: 'non_binary', label: 'Non-binary' },
        { value: 'transgender', label: 'Transgender' }, { value: 'other', label: 'Others not listed here' }, { value: 'prefer_not', label: 'Prefer not to say' },
      ] },
      { key: 'pets', type: 'multiselect', label: 'Which of the following pets do you have in your household?', required: true, options: [
        { value: 'birds', label: 'Bird(s)' }, { value: 'cats', label: 'Cat(s)' }, { value: 'dogs', label: 'Dog(s)' },
        { value: 'fish', label: 'Fish' }, { value: 'reptiles', label: 'Reptile(s)' }, { value: 'other', label: 'Other pet(s)' },
        { value: 'none', label: 'None of the above', exclusive: true },
      ] },
      { key: 'appliances', type: 'multiselect', label: 'Which of the following household appliances do you currently have in your household?', required: true, options: [
        { value: 'refrigerator', label: 'Refrigerator' }, { value: 'freezer', label: 'Freezer (separate unit)' },
        { value: 'oven', label: 'Oven (electric or gas)' }, { value: 'microwave', label: 'Microwave oven' },
        { value: 'electric_grill', label: 'Electric grill/griddle' }, { value: 'cooker', label: 'Cooker/hob/stove (electric,gas,induction)' },
        { value: 'toaster_oven', label: 'Toaster Oven' }, { value: 'pizza_oven', label: 'Pizza oven (indoor)' },
        { value: 'coffee_machine', label: 'Coffee machine (capsule/espresso/filter)' }, { value: 'soda_maker', label: 'Home soda maker' },
        { value: 'electric_kettle', label: 'Electric kettle' }, { value: 'toaster', label: 'Toaster' },
        { value: 'blender', label: 'Blender/food processor' }, { value: 'mixer', label: 'Mixer (hand or stand)' },
        { value: 'air_fryer', label: 'Air fryer' }, { value: 'dishwasher', label: 'Dishwasher' },
        { value: 'washing_machine', label: 'Washing machine' }, { value: 'tumble_dryer', label: 'Tumble dryer' },
        { value: 'washer_dryer', label: 'Washer-dryer (combined)' }, { value: 'vacuum_cordless', label: 'Vacuum cleaner (cordless)' },
        { value: 'vacuum_corded', label: 'Vacuum cleaner (corded)' }, { value: 'robot_vacuum', label: 'Robot vacuum cleaner' },
        { value: 'steam_cleaner', label: 'Steam cleaner' }, { value: 'air_conditioner', label: 'Air conditioner' },
        { value: 'electric_fan', label: 'Electric fan' }, { value: 'dehumidifier', label: 'Dehumidifier' },
        { value: 'humidifier', label: 'Humidifier' }, { value: 'portable_heater', label: 'Portable heater' },
        { value: 'other', label: 'Other' }, { value: 'prefer_not', label: 'Prefer not to answer', exclusive: true },
      ] },
    ]},
  },
  {
    key: 'employment', name: 'Employment', points: 100, sort: 3,
    schema: { version: 1, questions: [
      { key: 'employment_type', type: 'select', label: 'Employment type', required: true, options: [{ value: 'full_time', label: 'Full-time' }, { value: 'part_time', label: 'Part-time' }, { value: 'self_employed', label: 'Self-employed' }, { value: 'freelance', label: 'Freelance / contract' }, { value: 'student', label: 'Student' }, { value: 'homemaker', label: 'Homemaker' }, { value: 'retired', label: 'Retired' }, { value: 'unemployed', label: 'Unemployed' }] },
      { key: 'industry', type: 'select', label: 'Industry', required: false, options: [{ value: 'technology', label: 'Technology' }, { value: 'healthcare', label: 'Healthcare' }, { value: 'education', label: 'Education' }, { value: 'finance', label: 'Finance / Banking' }, { value: 'retail', label: 'Retail / E-commerce' }, { value: 'manufacturing', label: 'Manufacturing' }, { value: 'government', label: 'Government / Public sector' }, { value: 'other', label: 'Other' }] },
      { key: 'years_experience', type: 'select', label: 'Years of experience', required: false, options: [{ value: '0-2', label: '0–2 years' }, { value: '3-5', label: '3–5 years' }, { value: '6-10', label: '6–10 years' }, { value: '11-20', label: '11–20 years' }, { value: '20+', label: '20+ years' }] },
      { key: 'chief_wage_earner', type: 'radio', label: 'Are you the chief wage earner in your household?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    ]},
  },
  {
    key: 'finance', name: 'Finance', points: 100, sort: 4,
    schema: { version: 1, questions: [
      { key: 'income_bracket', type: 'select', label: 'Annual household income', required: true, options: [{ value: 'under_3l', label: 'Under ₹3 lakh' }, { value: '3l_6l', label: '₹3–6 lakh' }, { value: '6l_12l', label: '₹6–12 lakh' }, { value: '12l_25l', label: '₹12–25 lakh' }, { value: 'above_25l', label: 'Above ₹25 lakh' }] },
      { key: 'assets', type: 'multiselect', label: 'Assets owned', required: false, maxSelections: 6, options: [{ value: 'property', label: 'Property' }, { value: 'vehicle', label: 'Vehicle' }, { value: 'mutual_funds', label: 'Mutual funds / stocks' }, { value: 'insurance', label: 'Insurance policy' }, { value: 'gold', label: 'Gold / jewellery' }, { value: 'savings', label: 'Savings account' }] },
      { key: 'savings_habit', type: 'radio', label: 'Do you save regularly?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'sometimes', label: 'Sometimes' }, { value: 'no', label: 'No' }] },
      { key: 'chief_wage_earner', type: 'radio', label: 'Chief wage earner?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
    ]},
  },
  {
    key: 'health', name: 'Health', points: 100, sort: 5,
    schema: { version: 1, questions: [
      { key: 'general_health', type: 'radio', label: 'Overall health', required: true, options: [{ value: 'excellent', label: 'Excellent' }, { value: 'good', label: 'Good' }, { value: 'fair', label: 'Fair' }, { value: 'poor', label: 'Poor' }] },
      { key: 'exercise_frequency', type: 'select', label: 'Exercise frequency', required: true, options: [{ value: 'daily', label: 'Daily' }, { value: '3-5week', label: '3–5 times/week' }, { value: '1-2week', label: '1–2 times/week' }, { value: 'rarely', label: 'Rarely' }, { value: 'never', label: 'Never' }] },
      { key: 'diet_type', type: 'radio', label: 'Diet preference', required: true, options: [{ value: 'vegetarian', label: 'Vegetarian' }, { value: 'vegan', label: 'Vegan' }, { value: 'non_vegetarian', label: 'Non-vegetarian' }, { value: 'flexitarian', label: 'Flexitarian' }] },
      { key: 'health_conditions', type: 'multiselect', label: 'Any ongoing conditions?', required: false, maxSelections: 5, options: [{ value: 'diabetes', label: 'Diabetes' }, { value: 'hypertension', label: 'Hypertension' }, { value: 'heart', label: 'Heart condition' }, { value: 'thyroid', label: 'Thyroid' }, { value: 'none', label: 'None' }] },
    ]},
  },
  {
    key: 'personal_care', name: 'Personal Care', points: 100, sort: 6,
    schema: { version: 1, questions: [
      { key: 'monthly_spend', type: 'select', label: 'Monthly personal care spend', required: true, options: [{ value: 'under_500', label: 'Under ₹500' }, { value: '500_1500', label: '₹500–1,500' }, { value: '1500_3000', label: '₹1,500–3,000' }, { value: 'above_3000', label: 'Above ₹3,000' }] },
      { key: 'products_used', type: 'multiselect', label: 'Products you regularly use', required: false, maxSelections: 8, options: [{ value: 'skincare', label: 'Skincare' }, { value: 'haircare', label: 'Haircare' }, { value: 'cosmetics', label: 'Cosmetics / makeup' }, { value: 'fragrance', label: 'Perfume / fragrance' }, { value: 'oral_care', label: 'Oral care' }, { value: 'mens_grooming', label: "Men's grooming" }, { value: 'sunscreen', label: 'Sunscreen / SPF' }] },
      { key: 'buy_frequency', type: 'select', label: 'How often do you buy personal care products?', required: true, options: [{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'quarterly', label: 'Quarterly' }, { value: 'occasionally', label: 'Occasionally' }] },
    ]},
  },
  {
    key: 'lifestyle', name: 'Lifestyle', points: 100, sort: 7,
    schema: { version: 1, questions: [
      { key: 'hobbies', type: 'multiselect', label: 'Hobbies & interests', required: true, maxSelections: 6, options: [{ value: 'reading', label: 'Reading' }, { value: 'cooking', label: 'Cooking' }, { value: 'fitness', label: 'Fitness / sports' }, { value: 'gaming', label: 'Gaming' }, { value: 'music', label: 'Music' }, { value: 'art', label: 'Art / crafts' }, { value: 'gardening', label: 'Gardening' }, { value: 'photography', label: 'Photography' }, { value: 'travel', label: 'Travel' }] },
      { key: 'pets', type: 'radio', label: 'Do you have pets?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'social_freq', type: 'select', label: 'How often do you socialise?', required: true, options: [{ value: 'daily', label: 'Daily' }, { value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'rarely', label: 'Rarely' }] },
    ]},
  },
  {
    key: 'travel', name: 'Travel', points: 100, sort: 8,
    schema: { version: 1, questions: [
      { key: 'travel_frequency', type: 'select', label: 'Domestic trips per year', required: true, options: [{ value: '0', label: 'Never' }, { value: '1-2', label: '1–2' }, { value: '3-5', label: '3–5' }, { value: '6+', label: '6+' }] },
      { key: 'intl_frequency', type: 'select', label: 'International trips per year', required: false, options: [{ value: '0', label: 'Never' }, { value: '1', label: '1' }, { value: '2-3', label: '2–3' }, { value: '4+', label: '4+' }] },
      { key: 'travel_mode', type: 'multiselect', label: 'Preferred travel mode', required: true, maxSelections: 4, options: [{ value: 'flight', label: 'Flight' }, { value: 'train', label: 'Train' }, { value: 'road', label: 'Road / car' }, { value: 'bus', label: 'Bus' }] },
      { key: 'travel_type', type: 'radio', label: 'Travel style', required: true, options: [{ value: 'leisure', label: 'Leisure / holiday' }, { value: 'business', label: 'Business' }, { value: 'adventure', label: 'Adventure / backpacking' }, { value: 'pilgrimage', label: 'Pilgrimage / religious' }] },
    ]},
  },
  {
    key: 'shopping', name: 'Shopping', points: 100, sort: 9,
    schema: { version: 1, questions: [
      { key: 'shop_channels', type: 'multiselect', label: 'Where do you shop?', required: true, maxSelections: 5, options: [{ value: 'online', label: 'Online (Amazon, Flipkart, etc.)' }, { value: 'supermarket', label: 'Supermarket / hypermarket' }, { value: 'local', label: 'Local market' }, { value: 'mall', label: 'Shopping mall' }, { value: 'd2c', label: 'Brand websites (D2C)' }] },
      { key: 'monthly_spend', type: 'select', label: 'Monthly shopping spend', required: true, options: [{ value: 'under_2k', label: 'Under ₹2,000' }, { value: '2k_5k', label: '₹2,000–5,000' }, { value: '5k_15k', label: '₹5,000–15,000' }, { value: 'above_15k', label: 'Above ₹15,000' }] },
      { key: 'loyalty_programs', type: 'radio', label: 'Member of loyalty programs?', required: true, options: [{ value: 'yes_active', label: 'Yes, actively use them' }, { value: 'yes_passive', label: 'Yes, but rarely use them' }, { value: 'no', label: 'No' }] },
    ]},
  },
  {
    key: 'media', name: 'Media', points: 100, sort: 10,
    schema: { version: 1, questions: [
      { key: 'streaming_services', type: 'multiselect', label: 'Streaming services you use', required: false, maxSelections: 6, options: [{ value: 'netflix', label: 'Netflix' }, { value: 'amazon', label: 'Amazon Prime' }, { value: 'hotstar', label: 'Disney+ Hotstar' }, { value: 'sony', label: 'SonyLIV' }, { value: 'zee5', label: 'Zee5' }, { value: 'jiocinema', label: 'JioCinema' }] },
      { key: 'tv_hours', type: 'select', label: 'TV / streaming hours per day', required: true, options: [{ value: 'under_1', label: 'Under 1 hour' }, { value: '1-3', label: '1–3 hours' }, { value: '3-5', label: '3–5 hours' }, { value: 'above_5', label: 'Above 5 hours' }] },
      { key: 'news_source', type: 'radio', label: 'Primary news source', required: true, options: [{ value: 'tv', label: 'TV news' }, { value: 'newspaper', label: 'Newspaper' }, { value: 'online', label: 'Online / apps' }, { value: 'social', label: 'Social media' }, { value: 'none', label: 'I don\'t follow news' }] },
    ]},
  },
  {
    key: 'technology', name: 'Technology', points: 100, sort: 11,
    schema: { version: 1, questions: [
      { key: 'devices', type: 'multiselect', label: 'Devices you own', required: true, maxSelections: 6, options: [{ value: 'smartphone', label: 'Smartphone' }, { value: 'laptop', label: 'Laptop / PC' }, { value: 'tablet', label: 'Tablet' }, { value: 'smartwatch', label: 'Smartwatch' }, { value: 'smart_tv', label: 'Smart TV' }, { value: 'gaming_console', label: 'Gaming console' }] },
      { key: 'internet_hours', type: 'select', label: 'Internet usage hours per day', required: true, options: [{ value: 'under_2', label: 'Under 2 hours' }, { value: '2-4', label: '2–4 hours' }, { value: '4-8', label: '4–8 hours' }, { value: 'above_8', label: 'Above 8 hours' }] },
      { key: 'tech_adopter', type: 'radio', label: 'Tech adoption style', required: true, options: [{ value: 'early', label: 'Early adopter (first to try)' }, { value: 'mainstream', label: 'Mainstream (when popular)' }, { value: 'late', label: 'Late adopter (when necessary)' }] },
    ]},
  },
  {
    key: 'automotive', name: 'Automotive', points: 100, sort: 12,
    schema: { version: 1, questions: [
      { key: 'vehicle_ownership', type: 'radio', label: 'Do you own a vehicle?', required: true, options: [{ value: 'car', label: 'Car' }, { value: 'two_wheeler', label: 'Two-wheeler' }, { value: 'both', label: 'Both' }, { value: 'none', label: 'None' }] },
      { key: 'drive_frequency', type: 'select', label: 'How often do you drive?', required: false, options: [{ value: 'daily', label: 'Daily' }, { value: 'few_week', label: 'A few times/week' }, { value: 'weekend', label: 'Weekends only' }, { value: 'rarely', label: 'Rarely' }] },
      { key: 'next_purchase', type: 'select', label: 'Considering buying in next 12 months?', required: true, options: [{ value: 'yes_new', label: 'Yes — new vehicle' }, { value: 'yes_used', label: 'Yes — used vehicle' }, { value: 'no', label: 'No' }, { value: 'unsure', label: 'Unsure' }] },
    ]},
  },
  {
    key: 'video_games', name: 'Video Games', points: 100, sort: 13,
    schema: { version: 1, questions: [
      { key: 'gamer', type: 'radio', label: 'Do you play video / mobile games?', required: true, options: [{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }] },
      { key: 'platforms', type: 'multiselect', label: 'Platforms you play on', required: false, maxSelections: 5, options: [{ value: 'mobile', label: 'Mobile' }, { value: 'pc', label: 'PC' }, { value: 'playstation', label: 'PlayStation' }, { value: 'xbox', label: 'Xbox' }, { value: 'nintendo', label: 'Nintendo' }] },
      { key: 'hours_week', type: 'select', label: 'Gaming hours per week', required: false, options: [{ value: 'under_2', label: 'Under 2 hours' }, { value: '2-7', label: '2–7 hours' }, { value: '8-15', label: '8–15 hours' }, { value: 'above_15', label: 'Above 15 hours' }] },
      { key: 'spend', type: 'select', label: 'Monthly spend on games', required: false, options: [{ value: 'free', label: 'Free only' }, { value: 'under_500', label: 'Under ₹500' }, { value: '500_2000', label: '₹500–2,000' }, { value: 'above_2000', label: 'Above ₹2,000' }] },
    ]},
  },
  {
    key: 'social_activities', name: 'Social Activities', points: 200, sort: 14,
    schema: { version: 1, questions: [
      { key: 'activities', type: 'multiselect', label: 'Which of the following activities are you interested in?', required: true, options: [
        { value: 'discussion_boards', label: 'Online discussion boards' }, { value: 'one_to_one', label: '1 to 1 online interviews' },
        { value: 'video_focus', label: 'Online video focus groups' }, { value: 'live_interaction', label: 'Live online interaction' },
        { value: 'concept_ad', label: 'Concept and Ad testing' }, { value: 'in_home', label: 'In-home product tests' },
        { value: 'website_feedback', label: 'Website feedback' }, { value: 'diaries', label: 'Diaries' },
        { value: 'ai_chats', label: 'Conversational AI chats' }, { value: 'none', label: 'None of the above', exclusive: true },
      ] },
      { key: 'participate', type: 'radio', label: 'Do you wish to participate in Social Activities?', required: true, options: [
        { value: 'no', label: 'No' }, { value: 'yes', label: 'Yes, please include me' },
      ] },
    ]},
  },
];

// 8 segments; probabilities sum to exactly 1.0000. See overview §7.5.
const SPIN_SEGMENTS: Array<{
  label: string;
  points: number;
  prob: string;
  color: string;
  sort: number;
}> = [
  { label: 'Better luck next time!', points: 0, prob: '0.1500', color: '#94A3B8', sort: 1 },
  { label: '40 Points', points: 40, prob: '0.2000', color: '#F9A8D4', sort: 2 },
  { label: '80 Points', points: 80, prob: '0.2000', color: '#F472B6', sort: 3 },
  { label: '100 Points', points: 100, prob: '0.1800', color: '#EC4899', sort: 4 },
  { label: '200 Points', points: 200, prob: '0.1200', color: '#E91E8C', sort: 5 },
  { label: '300 Points', points: 300, prob: '0.0800', color: '#C2186F', sort: 6 },
  { label: '500 Points', points: 500, prob: '0.0500', color: '#9D1458', sort: 7 },
  { label: '1000 Points', points: 1000, prob: '0.0200', color: '#6B0E3C', sort: 8 },
];

const SIMPLE_ICON = (slug: string): string => `https://cdn.simpleicons.org/${slug}`;

const REWARDS: Array<{
  key: string;
  name: string;
  description: string;
  type: 'CHARITY' | 'PAYPAL' | 'VOUCHER' | 'MERCHANDISE';
  points: number;
  sort: number;
  imageUrl?: string;
}> = [
  {
    key: 'meals-africa',
    name: 'Offer 4 meals to kids (Africa)',
    description: 'Fight malnutrition in Africa — provide a healthy meal to children in need.',
    type: 'CHARITY',
    points: 4500,
    sort: 1,
  },
  {
    key: 'tree-madagascar',
    name: 'Plant 1 tree in Madagascar',
    description: 'Act for reforestation. Help rebuild biodiversity and restore natural habitats.',
    type: 'CHARITY',
    points: 4500,
    sort: 2,
  },
  {
    key: 'plastic-ocean',
    name: 'Remove 100 g of plastic from the ocean',
    description: "Fight plastic pollution. It's time to act against ocean waste.",
    type: 'CHARITY',
    points: 4500,
    sort: 3,
  },
  {
    key: 'paypal-usd',
    name: 'PayPal Payout (USD) — United States',
    description: 'Fast, Secure, and Global: PayPal Payouts straight to your linked account.',
    type: 'PAYPAL',
    points: 90000,
    sort: 4,
  },
  // ── Gift-card catalogue (VOUCHER) ──
  {
    key: 'gc-amazon',
    name: 'Amazon.in Gift Card INR | 90-Day validity',
    description: 'Amazon gift cards can be seamlessly converted to Amazon Pay balance and used across millions of products.',
    type: 'VOUCHER',
    points: 20000,
    sort: 5,
    imageUrl: SIMPLE_ICON('amazon'),
  },
  {
    key: 'gc-flipkart',
    name: 'Flipkart eGift Card INR | 90-Day Link',
    description: "Flipkart is India's most popular online shopping destination for electronics, fashion and more.",
    type: 'VOUCHER',
    points: 20000,
    sort: 6,
    imageUrl: SIMPLE_ICON('flipkart'),
  },
  {
    key: 'gc-pizzahut',
    name: 'Pizza Hut eGift Card 500 INR',
    description: 'Treat yourself to hot, cheesy, delicious pizzas from Pizza Hut.',
    type: 'VOUCHER',
    points: 50000,
    sort: 7,
    imageUrl: SIMPLE_ICON('pizzahut'),
  },
  {
    key: 'gc-croma',
    name: 'Croma eGift Card INR | 90-Day Link',
    description: 'Croma has always been dedicated towards giving its customers the best electronics experience.',
    type: 'VOUCHER',
    points: 25000,
    sort: 8,
  },
  {
    key: 'gc-dominos',
    name: "Domino's Pizza eGift Card 500 INR",
    description: "Domino's Pizza India has remained focused on delivering great-tasting pizzas to your door.",
    type: 'VOUCHER',
    points: 50000,
    sort: 9,
    imageUrl: SIMPLE_ICON('dominos'),
  },
  {
    key: 'gc-nykaa',
    name: 'Nykaa eGift Card 250 INR',
    description: 'Nykaa, a premier online beauty destination in India for cosmetics, skincare and wellness.',
    type: 'VOUCHER',
    points: 25000,
    sort: 10,
  },
  {
    key: 'gc-myntra',
    name: 'Myntra eGift Card 500 INR',
    description: "Myntra is India's most trendiest fashion hub with the widest range of styles.",
    type: 'VOUCHER',
    points: 50000,
    sort: 11,
    imageUrl: SIMPLE_ICON('myntra'),
  },
  {
    key: 'gc-makemytrip',
    name: 'Makemytrip eGift Card 500 INR',
    description: "MakeMyTrip.com, India's leading online travel company for flights, hotels and holidays.",
    type: 'VOUCHER',
    points: 50400,
    sort: 12,
  },
  {
    key: 'gc-amazon-prime',
    name: 'Amazon Prime Membership eGift Card',
    description: 'Access rapid delivery and digital entertainment with an Amazon Prime membership.',
    type: 'VOUCHER',
    points: 40000,
    sort: 13,
    imageUrl: SIMPLE_ICON('amazonprime'),
  },
  {
    key: 'gc-zomato',
    name: 'Zomato eGift Card 500 INR',
    description: 'Satisfy your food requirements instantly with Zomato food delivery.',
    type: 'VOUCHER',
    points: 50000,
    sort: 14,
    imageUrl: SIMPLE_ICON('zomato'),
  },
  {
    key: 'gc-swiggy',
    name: 'Swiggy Money Voucher eGift Card',
    description: 'Swiggy is an on-demand food delivery platform that brings your favourite meals home.',
    type: 'VOUCHER',
    points: 25000,
    sort: 15,
    imageUrl: SIMPLE_ICON('swiggy'),
  },
  {
    key: 'gc-uber',
    name: 'Uber eGift Card 250 INR',
    description: 'Plan your daily transit with UBER, providing a dependable ride at your fingertips.',
    type: 'VOUCHER',
    points: 25000,
    sort: 16,
    imageUrl: SIMPLE_ICON('uber'),
  },
  {
    key: 'gc-jio',
    name: 'Reliance My Jio Store eGift Card',
    description: 'Manage your telecom and electronic needs with Reliance My Jio Store.',
    type: 'VOUCHER',
    points: 25000,
    sort: 17,
  },
];

async function seedProfileCategories(): Promise<void> {
  for (const c of PROFILE_CATEGORIES) {
    await prisma.profileSurveyCategory.upsert({
      where: { key: c.key },
      update: { name: c.name, pointsValue: c.points, sortOrder: c.sort, schema: c.schema as Prisma.InputJsonValue },
      create: {
        key: c.key,
        name: c.name,
        pointsValue: c.points,
        sortOrder: c.sort,
        schema: c.schema as Prisma.InputJsonValue,
      },
    });
  }
  console.warn(`  ✓ ${PROFILE_CATEGORIES.length} profile survey categories`);
}

async function seedSpinGame(): Promise<void> {
  const game = await prisma.game.upsert({
    where: { id: SPIN_GAME_ID },
    update: { gameName: 'Daily Spin', isActive: true },
    create: { id: SPIN_GAME_ID, gameName: 'Daily Spin', gameType: 'SPIN_WHEEL', isFree: true },
  });

  // Replace segments deterministically so re-seeding stays consistent.
  await prisma.gameSegment.deleteMany({ where: { gameId: game.id } });
  await prisma.gameSegment.createMany({
    data: SPIN_SEGMENTS.map((s) => ({
      gameId: game.id,
      label: s.label,
      pointsValue: s.points,
      probability: new Prisma.Decimal(s.prob),
      color: s.color,
      sortOrder: s.sort,
    })),
  });

  const sum = SPIN_SEGMENTS.reduce((acc, s) => acc + Number(s.prob), 0);
  if (Math.abs(sum - 1) > 1e-9) {
    throw new Error(`Spin segment probabilities must sum to 1.0 (got ${sum})`);
  }
  console.warn(`  ✓ Daily Spin game + ${SPIN_SEGMENTS.length} segments (Σp = ${sum.toFixed(4)})`);
}

async function seedRewards(): Promise<void> {
  for (const r of REWARDS) {
    await prisma.reward.upsert({
      where: { id: rewardId(r.key) },
      update: {
        name: r.name,
        description: r.description,
        pointsRequired: r.points,
        sortOrder: r.sort,
        imageUrl: r.imageUrl ?? null,
      },
      create: {
        id: rewardId(r.key),
        name: r.name,
        description: r.description,
        rewardType: r.type,
        pointsRequired: r.points,
        sortOrder: r.sort,
        imageUrl: r.imageUrl ?? null,
        metadata: { key: r.key },
      },
    });
  }
  console.warn(`  ✓ ${REWARDS.length} rewards`);
}

const ANNOUNCEMENTS: Array<{
  key: string;
  emoji: string;
  title: string;
  excerpt: string;
  bannerHeadline: string;
  comments: number;
  sort: number;
}> = [
  {
    key: 'wc-campaign',
    emoji: '🏆',
    title: 'Our World Cup Campaign Has Come to an End!',
    excerpt:
      "What an incredible World Cup it's been! Over the past several weeks, members from around the world joined us to celebrate, compete and win big.",
    bannerHeadline: 'WORLD CUP · CAMPAIGN COMPLETE',
    comments: 19,
    sort: 1,
  },
  {
    key: 'wc-predictions',
    emoji: '🏆',
    title: 'The Final Stage Is Now Live — One Last Chance to Become Champion!',
    excerpt:
      "Stage 1 and 2 of our World Cup Predictions game have officially ended — and after some incredible matches, we're excited to launch the final stage.",
    bannerHeadline: 'WORLD CUP · PREDICTIONS',
    comments: 13,
    sort: 2,
  },
  {
    key: 'wc-penalty',
    emoji: '⚽',
    title: 'The World Cup Penalty Game is Officially Live! Edit Entry',
    excerpt:
      'The wait is over — all our World Cup games are now fully live! 🌍 🏆 From predictions to penalty shootouts and fan competitions, there are now more ways to win.',
    bannerHeadline: 'WORLD CUP · PENALTY SHOT!',
    comments: 38,
    sort: 3,
  },
  {
    key: 'eggmatch-open',
    emoji: '🥚',
    title: 'World Cup Predictions Are Now Open!',
    excerpt:
      'The World Cup is almost here… and you can already start making your predictions! ⚽ 🏆 Our Predictions game is officially open before kick-off.',
    bannerHeadline: 'MAKE YOUR PREDICTIONS',
    comments: 20,
    sort: 4,
  },
  {
    key: 'eggmatch-winners',
    emoji: '🎉',
    title: 'Meet Our EggMatch Winners!',
    excerpt:
      "Our EggMatch challenge has come to an end, and we've loved seeing your memory skills in action. A huge thank you to everyone who joined and played.",
    bannerHeadline: 'EGG MATCH · WINNERS',
    comments: 58,
    sort: 5,
  },
  {
    key: 'eggmatch-play',
    emoji: '🧠',
    title: 'Test your memory with Egg Match!',
    excerpt:
      'Discover our latest game, Egg Match, where fun meets rewards! Ready to put your skills to the test? Visit the Games page to play and win points.',
    bannerHeadline: 'EGG MATCH · 2–16 APRIL',
    comments: 25,
    sort: 6,
  },
  {
    key: 'lucky-draw',
    emoji: '🎁',
    title: 'Win points in our festive lucky draw',
    excerpt:
      'Dear Members, celebrate the end of the year with a boost to your points balance! To enter the draw, all you have to do is complete two or more surveys.',
    bannerHeadline: 'WIN 15,000 POINTS',
    comments: 179,
    sort: 7,
  },
  {
    key: 'ski-camp',
    emoji: '⛷️',
    title: 'Welcome to the Ski Camp!',
    excerpt:
      "From 15 to 29 December, we're inviting you to play our brand-new ski-themed game with 3 fun levels, and win instant bonuses of up to 3,000 points.",
    bannerHeadline: 'SKI CAMP · 15–29 DEC',
    comments: 20,
    sort: 8,
  },
  {
    key: 'haunted-house',
    emoji: '👻',
    title: 'Enter the Haunted House, we dare you!',
    excerpt:
      "It's time to face the Haunted House! 🎃 Our spooky new game is now live. Face all the ghosts and monsters to win up to 10,000 points.",
    bannerHeadline: 'HAUNTED HOUSE',
    comments: 46,
    sort: 9,
  },
];

async function seedAnnouncements(): Promise<void> {
  for (const [i, a] of ANNOUNCEMENTS.entries()) {
    await prisma.announcement.upsert({
      where: { id: announcementId(a.key) },
      update: {
        title: a.title,
        excerpt: a.excerpt,
        bannerHeadline: a.bannerHeadline,
        emoji: a.emoji,
        commentsCount: a.comments,
        sortOrder: a.sort,
      },
      create: {
        id: announcementId(a.key),
        title: a.title,
        excerpt: a.excerpt,
        bannerHeadline: a.bannerHeadline,
        emoji: a.emoji,
        commentsCount: a.comments,
        sortOrder: a.sort,
        publishedAt: new Date(Date.now() - i * 86_400_000),
      },
    });
  }
  console.warn(`  ✓ ${ANNOUNCEMENTS.length} announcements`);
}

function announcementId(key: string): string {
  const map: Record<string, string> = {
    'wc-campaign': '00000000-0000-4000-8000-000000000201',
    'wc-predictions': '00000000-0000-4000-8000-000000000202',
    'wc-penalty': '00000000-0000-4000-8000-000000000203',
    'eggmatch-open': '00000000-0000-4000-8000-000000000204',
    'eggmatch-winners': '00000000-0000-4000-8000-000000000205',
    'eggmatch-play': '00000000-0000-4000-8000-000000000206',
    'lucky-draw': '00000000-0000-4000-8000-000000000207',
    'ski-camp': '00000000-0000-4000-8000-000000000208',
    'haunted-house': '00000000-0000-4000-8000-000000000209',
  };
  const id = map[key];
  if (!id) throw new Error(`No fixed announcement id for key ${key}`);
  return id;
}

async function seedSuperAdmin(): Promise<void> {
  const email = process.env.SEED_SUPERADMIN_EMAIL;
  const password = process.env.SEED_SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.warn('  ⚠ SEED_SUPERADMIN_EMAIL/PASSWORD not set — skipping super-admin');
    return;
  }
  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.admin.upsert({
    where: { email },
    update: { role: 'SUPER_ADMIN', isActive: true },
    create: { email, passwordHash, name: 'Super Admin', role: 'SUPER_ADMIN' },
  });
  console.warn(`  ✓ super-admin (${email})`);
}

// Deterministic UUIDv5-ish namespacing via fixed IDs keeps upserts idempotent.
const SPIN_GAME_ID = '00000000-0000-4000-8000-000000000001';
function rewardId(key: string): string {
  // Stable synthetic UUIDs for the seeded catalogue (key -> fixed id).
  const map: Record<string, string> = {
    'meals-africa': '00000000-0000-4000-8000-000000000101',
    'tree-madagascar': '00000000-0000-4000-8000-000000000102',
    'plastic-ocean': '00000000-0000-4000-8000-000000000103',
    'paypal-usd': '00000000-0000-4000-8000-000000000104',
    'gc-amazon': '00000000-0000-4000-8000-000000000105',
    'gc-flipkart': '00000000-0000-4000-8000-000000000106',
    'gc-pizzahut': '00000000-0000-4000-8000-000000000107',
    'gc-croma': '00000000-0000-4000-8000-000000000108',
    'gc-dominos': '00000000-0000-4000-8000-000000000109',
    'gc-nykaa': '00000000-0000-4000-8000-000000000110',
    'gc-myntra': '00000000-0000-4000-8000-000000000111',
    'gc-makemytrip': '00000000-0000-4000-8000-000000000112',
    'gc-amazon-prime': '00000000-0000-4000-8000-000000000113',
    'gc-zomato': '00000000-0000-4000-8000-000000000114',
    'gc-swiggy': '00000000-0000-4000-8000-000000000115',
    'gc-uber': '00000000-0000-4000-8000-000000000116',
    'gc-jio': '00000000-0000-4000-8000-000000000117',
  };
  const id = map[key];
  if (!id) throw new Error(`No fixed reward id for key ${key}`);
  return id;
}

async function seedSurveys(): Promise<void> {
  const count = await prisma.survey.count();
  if (count > 0) {
    console.warn('  ⚠ Surveys already seeded, skipping');
    return;
  }

  const surveys = [
    // Generic (no targeting) — visible to all
    {
      title: 'Community Voice — Gen Z Trends',
      description: 'Share your opinions on the latest lifestyle and entertainment trends.',
      type: 'QUICK' as const,
      pointsValue: 150,
      estimatedMins: 5,
      targeting: null,
    },
    {
      title: 'Brand Awareness Study',
      description: 'Help us understand how you discover and interact with brands online.',
      type: 'PRIORITY' as const,
      pointsValue: 200,
      estimatedMins: 8,
      targeting: null,
    },
    {
      title: 'Digital India Survey — Premium',
      description: "A comprehensive look at India's digital economy. High-value, 30-minute study.",
      type: 'PREMIUM' as const,
      pointsValue: 3400,
      estimatedMins: 30,
      targeting: null,
    },
    // Targeted surveys
    {
      title: 'Skincare Habits — Women 18-35',
      description: 'Insights on personal care routines and product preferences.',
      type: 'QUICK' as const,
      pointsValue: 250,
      estimatedMins: 7,
      targeting: { gender: ['FEMALE'], age: { min: 18, max: 35 } },
    },
    {
      title: 'Investment & Savings Study',
      description: 'Share your views on financial products and investment habits.',
      type: 'PRIORITY' as const,
      pointsValue: 400,
      estimatedMins: 12,
      targeting: { employment: ['SALARIED', 'SELF_EMPLOYED'], income: ['5L_10L', '10L_PLUS'] },
    },
    {
      title: 'Urban Mobility & EV Interest',
      description: 'Understanding commuter preferences and electric vehicle adoption.',
      type: 'PREMIUM' as const,
      pointsValue: 1800,
      estimatedMins: 20,
      targeting: { region: { areaType: ['URBAN'] }, age: { min: 22, max: 45 } },
    },
  ];

  await prisma.survey.createMany({
    data: surveys.map((s) => ({
      title: s.title,
      description: s.description,
      type: s.type,
      pointsValue: s.pointsValue,
      estimatedMins: s.estimatedMins,
      ...(s.targeting !== null ? { targeting: s.targeting as Prisma.InputJsonValue } : {}),
      isActive: true,
    })),
  });

  console.warn(`  ✓ ${surveys.length} brand surveys`);
}

async function seedPolls(prisma: PrismaClient): Promise<void> {
  const count = await prisma.poll.count();
  if (count > 0) {
    console.warn('  ⚠ Polls already seeded, skipping');
    return;
  }

  // Sample polls from the spec
  await prisma.poll.create({
    data: {
      question: "Do you think Westside brand is a 'Made in India' brand?",
      pollType: 'SINGLE_CHOICE',
      sponsorName: 'Westside',
      pointsReward: 15,
      options: {
        create: [
          { optionText: 'Yes', sortOrder: 0 },
          { optionText: 'No', sortOrder: 1 },
        ],
      },
    },
  });

  await prisma.poll.create({
    data: {
      question: 'How frequently do you listen to FM Radio?',
      pollType: 'MULTI_CHOICE',
      sponsorName: 'RadioMirchi',
      pointsReward: 15,
      options: {
        create: [
          { optionText: 'Everyday', sortOrder: 0 },
          { optionText: '2–3 days a week', sortOrder: 1 },
          { optionText: '1 day a week', sortOrder: 2 },
          { optionText: 'Less frequently', sortOrder: 3 },
          { optionText: 'Do not listen', sortOrder: 4 },
        ],
      },
    },
  });

  await prisma.poll.create({
    data: {
      question: 'Which payment method do you use most for online shopping?',
      pollType: 'SINGLE_CHOICE',
      pointsReward: 15,
      options: {
        create: [
          { optionText: 'UPI', sortOrder: 0 },
          { optionText: 'Credit / Debit Card', sortOrder: 1 },
          { optionText: 'Net Banking', sortOrder: 2 },
          { optionText: 'Cash on Delivery', sortOrder: 3 },
        ],
      },
    },
  });

  console.warn('  ✓ 3 polls seeded');
}

async function seedGames(prismaClient: PrismaClient): Promise<void> {
  const count = await prismaClient.game.count();
  if (count > 0) {
    console.warn('  ⚠ Games already seeded, skipping');
    return;
  }

  await prismaClient.game.create({
    data: {
      gameName: 'Spin the Daily Wheel',
      gameType: 'SPIN_WHEEL',
      isFree: true,
      segments: {
        create: [
          { label: 'Better luck next time!', pointsValue: 0,    probability: 0.1500, color: '#9E9E9E', sortOrder: 0 },
          { label: '40 Points',              pointsValue: 40,   probability: 0.2000, color: '#FF7043', sortOrder: 1 },
          { label: '80 Points',              pointsValue: 80,   probability: 0.2000, color: '#FFA726', sortOrder: 2 },
          { label: '100 Points',             pointsValue: 100,  probability: 0.1800, color: '#FFCA28', sortOrder: 3 },
          { label: '200 Points',             pointsValue: 200,  probability: 0.1200, color: '#66BB6A', sortOrder: 4 },
          { label: '300 Points',             pointsValue: 300,  probability: 0.0800, color: '#26C6DA', sortOrder: 5 },
          { label: '500 Points',             pointsValue: 500,  probability: 0.0500, color: '#42A5F5', sortOrder: 6 },
          { label: '1000 Points',            pointsValue: 1000, probability: 0.0200, color: '#E91E8C', sortOrder: 7 },
        ],
      },
    },
  });

  console.warn('  ✓ Seeded 1 game with 8 segments (Σprobability = 1.0000)');
}

async function main(): Promise<void> {
  console.warn('Seeding reference data…');
  await seedProfileCategories();
  await seedSpinGame();
  await seedRewards();
  await seedAnnouncements();
  await seedSuperAdmin();
  await seedSurveys();
  await seedPolls(prisma);
  await seedGames(prisma);
  console.warn('Seed complete.');
}

main()
  .catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
