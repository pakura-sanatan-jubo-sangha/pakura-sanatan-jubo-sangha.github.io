GitHub Deployment & Permissions Guide (গিটহাব ডিপ্লয়মেন্ট নির্দেশিকা)
১. "Permission denied" কেন হয়? (Why Permission Denied Occurred)
GitHub-এর নিরাপত্তা নিয়মানুযায়ী, কোনো থার্ড-পার্টি অ্যাপ (যেমন Google AI Studio) যখন গিটহাবে কমিট পুশ করে, তখন যদি কমিটে .github/workflows/ ফোল্ডারের ফাইল থাকে, তাহলে GitHub সেই পুশ সরাসরি ব্লক করে দেয় (403 Permission Denied: Refusing to create or update workflow without 'workflow' scope)।
আপনার প্রজেক্টে ইতিমধ্যে .github/workflows/build.yml সক্রিয় ছিল। নতুন করে .github/workflows/deploy.yml যুক্ত হওয়ায় গিটহাব পুশ পারমিশন ব্লক করেছিল। ডুপ্লিকেট ফাইলটি মুছে ফেলা হয়েছে।
২. গিটহাব পুশ নিশ্চিত করার ধাপসমূহ (Steps to Ensure Push Succeeds)
ধাপ ক: আবার পুশ চেষ্টা করুন (Retry Push)
ডুপ্লিকেট deploy.yml মুছে ফেলার পর AI Studio-এর "Push commit to GitHub" বোতামে আবার ক্লিক করে চেষ্টা করুন।
ধাপ খ: ব্রাঞ্চ প্রটেকশন চেক করুন (Check Branch Protection)
যদি আপনার রিপোজিটরির main ব্রাঞ্চে Ruleset বা Branch Protection সক্রিয় থাকে:
GitHub-এ আপনার রিপোজিটরিতে যান: https://github.com/<your-username>/pakura-sanatan-jubo-sangha.github.io
Settings -> Branches-এ যান।
যদি Require a pull request before merging চালু থাকে, তবে সরাসরি পুশ করার জন্য সাময়িকভাবে এটি বন্ধ করুন অথবা আপনার অ্যাকাউন্টকে বাইপাস লিস্টে যোগ করুন।
ধাপ গ: AI Studio-তে গিটহাব পুনঃঅনুমোদন (Re-connect GitHub in AI Studio)
যদি আপনার গিটহাব টোকেনের মেয়াদ শেষ হয়ে থাকে:
AI Studio ইন্টারফেসের GitHub সংযোগ অপশনে যান।
Disconnect করে আবার Connect with GitHub করুন।
পারমিশন চাওয়ার সময় "All repositories" অথবা আপনার নির্দিষ্ট রিপোজিটরিটি সিলেক্ট করে Read & Write পারমিশন প্রদান করুন।
৩. গিটহাব পেজেস ডিপ্লয়মেন্ট ওয়ার্কফ্লো (GitHub Pages Deployment Workflow)
আপনার রিপোজিটরিতে GitHub Actions-এর মাধ্যমে অটোমেটিক বিল্ড ও ডিপ্লয় করার জন্য .github/workflows/build.yml-এ নিচের কোডটি ইতিমধ্যে প্রস্তুত রয়েছে:
code
Yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [ main, master ]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: 'pages'
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout Code
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install Dependencies
        run: npm install --legacy-peer-deps

      - name: Build Project
        run: npm run build

      - name: Setup Pages
        uses: actions/configure-pages@v5

      - name: Upload Pages Artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: './dist'

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    runs-on: ubuntu-latest
    needs: build
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
টিপস: গিটহাব রিপোজিটরির Settings -> Pages-এ গিয়ে Source হিসেবে "GitHub Actions" নির্বাচিত রাখুন। প্রতিবার পুশ করার সাথে সাথে সাইটটি স্বয়ংক্রিয়ভাবে বিল্ড হয়ে লাইভ হয়ে যাবে।
