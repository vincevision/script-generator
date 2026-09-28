// Shared catalogue vocabulary (also exposed to the storefront via /api/config)
export const CATEGORIES = [
  { slug: 't-shirts', label: 'T-Shirts', icon: 'shirt' },
  { slug: 'hoodies', label: 'Hoodies', icon: 'hoodie' },
  { slug: 'sweatshirts', label: 'Sweatshirts', icon: 'hoodie' },
  { slug: 'jackets', label: 'Jackets', icon: 'jacket' },
  { slug: 'cargo-pants', label: 'Cargo Pants', icon: 'pants' },
  { slug: 'jeans', label: 'Jeans', icon: 'pants' },
  { slug: 'joggers', label: 'Joggers', icon: 'pants' },
  { slug: 'shorts', label: 'Shorts', icon: 'shorts' },
  { slug: 'tracksuits', label: 'Tracksuits', icon: 'jacket' },
  { slug: 'dresses', label: 'Dresses', icon: 'dress' },
  { slug: 'accessories', label: 'Accessories', icon: 'cap' },
];
export const CATEGORY_SLUGS = CATEGORIES.map((c) => c.slug);
export const GENDERS = ['men', 'women', 'unisex'];
export const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
export const ORDER_STATUSES = ['placed', 'processing', 'packed', 'shipped', 'delivered', 'cancelled'];

export const KENYA_COUNTIES = [
  'Baringo', 'Bomet', 'Bungoma', 'Busia', 'Elgeyo-Marakwet', 'Embu', 'Garissa', 'Homa Bay', 'Isiolo', 'Kajiado',
  'Kakamega', 'Kericho', 'Kiambu', 'Kilifi', 'Kirinyaga', 'Kisii', 'Kisumu', 'Kitui', 'Kwale', 'Laikipia',
  'Lamu', 'Machakos', 'Makueni', 'Mandera', 'Marsabit', 'Meru', 'Migori', 'Mombasa', "Murang'a", 'Nairobi',
  'Nakuru', 'Nandi', 'Narok', 'Nyamira', 'Nyandarua', 'Nyeri', 'Samburu', 'Siaya', 'Taita-Taveta', 'Tana River',
  'Tharaka-Nithi', 'Trans-Nzoia', 'Turkana', 'Uasin Gishu', 'Vihiga', 'Wajir', 'West Pokot',
];
