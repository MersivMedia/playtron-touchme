cd .vitepress/dist

git init
git remote add origin git@github.com:davay42/touchme.git 
git add . --force
git commit -m 'deploy'

git push -f origin HEAD:gh-pages

cd -