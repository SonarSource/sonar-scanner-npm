load("cirrus", "env")
load("github.com/SonarSource/cirrus-modules@v3", "load_features")

def main(ctx):
  result = load_features(ctx)
  resultEnv = result.get("env")
  
  branchName = env.get("CIRRUS_BRANCH")
  slug = branchName.replace("/", "--")
  
  resultEnv.update({
    "BRANCH_SLUG": slug
  })
  
  result.update({"env": resultEnv})
  
  return result
