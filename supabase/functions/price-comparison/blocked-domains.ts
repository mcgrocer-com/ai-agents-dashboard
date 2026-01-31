/**
 * Blocked Domains List
 *
 * Comprehensive list of 105+ UK price comparison sites, aggregators,
 * marketplaces, and non-retailer sites that should be filtered out
 * from price comparison results.
 *
 * Organized by category for easy maintenance.
 */

export const BLOCKED_DOMAINS = [
  // === MAJOR UK PRICE COMPARISON SITES ===
  'pricerunner.com',
  'pricespy.co.uk',
  'idealo.co.uk',
  'kelkoo.co.uk',
  'skinflint.co.uk',
  'pricehunter.co.uk',
  'pricechecker.co.uk',
  'foundem.co.uk',
  'twenga.co.uk',
  '123pricecheck.com',
  'comparism.com',
  'bigshopper.co.uk',
  'compareaprice.co.uk',
  'price4.co.uk',

  // === SHOPPING AGGREGATORS & SEARCH ENGINES ===
  'google.com/shopping',
  'shopping.google.com',
  'shopzilla.co.uk',
  'shopzilla.com',
  'shopping.com',
  'bizrate.com',
  'become.com',
  'pricegrabber.com',
  'shopping.yahoo.com',
  'bing.com/shop',
  'pricesearcher.com',
  'shopbot.com',
  'nextag.com',

  // === DEAL/VOUCHER SITES ===
  'hotukdeals.com',
  'vouchercodes.co.uk',
  'myvouchers.co.uk',
  'retailmenot.co.uk',
  'retailmenot.com',
  'savoo.co.uk',
  'lovemyvouchers.co.uk',
  'lovevoucher.co.uk',
  'lovediscountvouchers.co.uk',
  'dealsdaddy.co.uk',
  'latestdeals.co.uk',
  'offeroftheday.co.uk',
  'groupon.co.uk',
  'groupon.com',
  'wowcher.co.uk',
  'honey.com',

  // === CASHBACK SITES ===
  'topcashback.co.uk',
  'topcashback.com',
  'quidco.com',
  'rakuten.co.uk',
  'rakuten.com',
  'widilo.co.uk',
  'ohmydosh.co.uk',
  'swagbucks.co.uk',
  'swagbucks.com',
  'budgey.co.uk',

  // === GROCERY/SUPERMARKET COMPARISON ===
  'trolley.co.uk',
  'mysupermarketcompare.co.uk',
  'shopsplit.uk',
  'hellosupermarket.co.uk',
  'mealmatcher.co.uk',
  'grocerycompare.co.uk',

  // === TECH/ELECTRONICS COMPARISON ===
  'uk.pcpartpicker.com',
  'pcpartpicker.com',
  'pcparts.uk',
  'geizhals.eu',
  'geizhals.de',
  'comparator.co.uk',
  'camelcamelcamel.com',
  'pricepirates.co.uk',

  // === INSURANCE/FINANCE COMPARISON (if they show products) ===
  'comparethemarket.com',
  'gocompare.com',
  'moneysupermarket.com',
  'confused.com',
  'uswitch.com',
  'choose.co.uk',
  'moneysavingexpert.com',

  // === UTILITIES/BROADBAND COMPARISON ===
  'energy.which.co.uk',
  'switcheroo.co.uk',
  'powercompare.co.uk',
  'utilityking.co.uk',
  'uw.co.uk',
  'bestbroadbanddeals.co.uk',
  'cable.co.uk',

  // === TRAVEL COMPARISON ===
  'travelsupermarket.com',
  'skyscanner.net',
  'skyscanner.com',
  'kayak.co.uk',
  'kayak.com',
  'momondo.co.uk',
  'momondo.com',
  'trivago.co.uk',
  'trivago.com',
  'google.com/flights',

  // === FASHION COMPARISON & MARKETPLACES ===
  'farfetch.com',       // Fashion marketplace
  'lyst.co.uk',
  'lyst.com',
  'shopstyle.co.uk',
  'shopstyle.com',
  'fashiola.co.uk',
  'stylight.co.uk',
  'stylight.com',

  // === MARKETPLACE AGGREGATORS ===
  'ebay.co.uk',
  'ebay.com',
  'onbuy.com',
  'fruugo.co.uk',
  'fruugo.com',

  // === CAR/VEHICLE COMPARISON ===
  'carwow.co.uk',
  'autotrader.co.uk',
  'whatcar.com',

  // === MOBILE PHONE COMPARISON ===
  'carphonewarehouse.com',
  'mobilephonesdirect.co.uk',
  'fonehouse.co.uk',
  'affordablemobiles.co.uk',
  'e2save.com',
  'phonesltd.co.uk',
  'comparemymobile.com',

  // === BOOK COMPARISON ===
  'addall.com',
  'euro-book.co.uk',
  'best-book-price.co.uk',
  'bookfinder.com',
  'abebooks.co.uk',
  'abebooks.com',
  'alibris.com',
  'biblio.co.uk',
  'usedbooksearch.co.uk',

  // === HOME/FURNITURE COMPARISON ===
  'ufurnish.com',
  'furnitureinspiration.co.uk',

  // === BEAUTY/PERFUME COMPARISON ===
  'cosmetify.com',
  'perfumeprice.co.uk',

  // === DIY/BUILDING COMPARISON ===
  'comparethebuild.com',
  'tradessupermarket.com',

  // === ALCOHOL/DRINKS COMPARISON ===
  'wine-searcher.com',
  'drinkfinder.co.uk',

  // === PET PRODUCTS COMPARISON ===
  'petmoneysaver.co.uk',
  'petfood.co.uk',

  // === SPORTS COMPARISON ===
  'sportsprice.co.uk',

  // === MUSIC/INSTRUMENTS COMPARISON ===
  'reverb.com',

  // === WATCHES/JEWELLERY COMPARISON ===
  'chrono24.co.uk',
  'chrono24.com',

  // === INTERNATIONAL WITH UK PRESENCE ===
  'maxspar.de',
  'hoteudeals.com',
  'geizr.de',
  'vergelijk.be',
  'shoppingin.eu',

  // === WIKI/INFORMATION SITES ===
  'brickipedia.fandom.com',
  'fandom.com',
  'wikipedia.org',
  'wikia.com',

  // === OWN COMPANY (exclude from price comparison) ===
  'mcgrocer.com',

  // === SOCIAL MEDIA (not retailers) ===
  'facebook.com',
  'fb.com',
  'instagram.com',
  'twitter.com',
  'x.com',
  'tiktok.com',
  'pinterest.com',
  'pinterest.co.uk',
  'linkedin.com',
  'reddit.com',
  'youtube.com',
  'youtu.be',
  'snapchat.com',
  'tumblr.com',
  'whatsapp.com',
  'telegram.org',
  'discord.com',
  'discord.gg',
  'threads.net',
  'mastodon.social',

  // === NEWS/MEDIA SITES (not retailers) ===
  'thesun.co.uk',
  'dailymail.co.uk',
  'mirror.co.uk',
  'express.co.uk',
  'theguardian.com',
  'telegraph.co.uk',
  'independent.co.uk',
  'bbc.co.uk',
  'bbc.com',
  'sky.com',
  'metro.co.uk',
  'standard.co.uk',
  'manchestereveningnews.co.uk',
  'liverpoolecho.co.uk',
  'birminghammail.co.uk',
  'walesonline.co.uk',
  'chroniclelive.co.uk',

  // === REVIEW/BLOG SITES (not retailers) ===
  'trustpilot.com',
  'reviewcentre.com',
  'reviews.io',
  'yelp.com',
  'yelp.co.uk',
  'tripadvisor.com',
  'tripadvisor.co.uk',
  'medium.com',
  'blogger.com',
  'blogspot.com',
  'wordpress.com',
  'wix.com',
  'squarespace.com',
  'goodreads.com',

  // === CLASSIFIED/LISTING SITES (not retailers) ===
  'gumtree.com',
  'preloved.co.uk',
  'vinted.co.uk',
  'vinted.com',
  'depop.com',
  'craigslist.org',
  'shpock.com',
  'nextdoor.co.uk',
  'nextdoor.com',
];

/**
 * Check if URL is from a blocked domain
 */
export function isBlockedDomain(url: string): boolean {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return BLOCKED_DOMAINS.some(blocked => hostname.includes(blocked.toLowerCase()));
  } catch {
    return false;
  }
}
