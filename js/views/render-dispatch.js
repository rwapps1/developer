// The main render() dispatcher. Loads last among the view files since it
// calls every other render* function by name.


  // Tracks the previous screen so render() can tell a real navigation
  // (scroll should jump to top) apart from an in-screen re-render like
  // checking a quiz answer or toggling the menu (scroll should stay put).
  let lastScreen = null;

  function render() {
    const isNewScreen = state.screen !== lastScreen;
    lastScreen = state.screen;

    if (state.screen === 'login') renderLogin();
    else if (state.screen === 'start') renderStart();
    else if (state.screen === 'game-modes') renderGameModes();
    else if (state.screen === 'quiz-setup') renderQuizSetup();
    else if (state.screen === 'sentences-setup') renderSentencesSetup();
    else if (state.screen === 'categories') renderCategories();
    else if (state.screen === 'category-setup') renderCategorySetup();
    else if (state.screen === 'conjugate-setup') renderConjugateSetup();
    else if (state.screen === 'conjugate') renderConjugate();
    else if (state.screen === 'conjugate-result') renderConjugateResult();
    else if (state.screen === 'quiz') renderQuiz();
    else if (state.screen === 'timeattack-setup') renderTimeAttackSetup();
    else if (state.screen === 'timeattack') renderTimeAttack();
    else if (state.screen === 'memory-setup') renderMemorySetup();
    else if (state.screen === 'memory-play') renderMemoryPlay();
    else if (state.screen === 'memory-result') renderMemoryResult();
    else if (state.screen === 'celebrate') renderCelebrate();
    else if (state.screen === 'stream-checkpoint') renderStreamCheckpoint();
    else if (state.screen === 'level-up') renderLevelUp();
    else if (state.screen === 'result') {
      if (state.resultMode === 'timeattack') renderTimeAttackResult();
      else renderResult();
    }
    else if (state.screen === 'achievements') renderAchievements();
    else if (state.screen === 'achievements-detail') renderAchievementGroup();
    else if (state.screen === 'my-progress') renderMyProgress();
    else if (state.screen === 'xp-info') renderXPInfo();

    if (isNewScreen) window.scrollTo(0, 0);
    if (isNewScreen) syncBackHistory();
  }
