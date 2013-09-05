'use strict';
var mongoose = require('mongoose'),
    models = mongoose.models;
    // async = require('async');

exports.get = function(req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    models.Thread.find()
        .populate('posts')
        .populate('owner', 'username')
        .exec(function(err, results) {
            if (!err) {
                res.render('threads/all_threads', {
                    title: 'Threads',
                    url: req.url,
                    user: req.user,
                    threads: results,
                    errorFlash: req.flash('error'),
                    infoFlash: req.flash('info')
                });
            }
        });

};

exports.popular = function(req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    models.Thread.find({})
        .$where('this.posts.length > 5')
        .populate('posts')
        .populate('owner', 'username')
        .exec(function(err, results) {
            if (!err) {
                res.render('threads/popular_threads', {
                    title: 'Popular Threads',
                    url: req.url,
                    user: req.user,
                    threads: results,
                    errorFlash: req.flash('error'),
                    infoFlash: req.flash('info')
                });
            }
        });

};

exports.new = function(req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }
    res.render('threads/new_thread_form', {
        title: 'Create New Thread',
        url: req.url,
        user: req.user,
        errorFlash: req.flash('error'),
        infoFlash: req.flash('info')
    });
};

exports.newthread = function(req, res) {
    if (!req.user) {
        res.redirect('/login');
        return;
    }

    if (req.body.title.trim() === '' || req.body.description.trim() === '') {
        req.flash('error', 'Problem processing your request. Please try again');
        res.redirect(req.url);
        return;
    }

    var title = req.body.title.trim();
    var threadData = {};
    threadData.title = title;
    threadData.owner = req.user._id;

    var thread = new models.Thread(threadData);
    thread.save(function(err, thread) {
        if (err) {
            req.flash('error', err);
            res.redirect('/threads/new');
            return;
        }
        var postData = {
            message: req.body.description.trim(),
            owner: req.user._id,
            thread: thread._id
        };
        var p = new models.Post(postData);
        p.save(function(err, post) {
            if (!err) {
                // Update users' threads sub documents
                req.user.updateThreads(thread._id);
                // Update user's posts sub documents
                req.user.updatePosts(post._id);
                // Update thread's post sub documents
                thread.updatePosts(post._id);
                // Update post's owner
            }
        });
        req.flash('info', 'Thread successfully added!');
        res.redirect('/threads/' + thread.slug);
    });

};

exports.single = function(req, res, next) {

    var slug = req.params.thread;

    if (slug === undefined || slug === 'new' || slug === 'popular') {
        next();
        return;
    }

    models.Thread
        .findOne({
            slug: slug
        })
        .populate('owner', 'username')
        .populate('posts')
        .populate('posts.owner')
        .exec(function(err, th) {
            if (!err) {
                res.render('threads/single_threads', {
                    title: th.title,
                    url: req.url,
                    user: req.user,
                    thread: th,
                    errorFlash: req.flash('error'),
                    infoFlash: req.flash('info')
                });
            }
        });
};

exports.newpost = function(req, res, next) {
    if (req.params.thread === 'new') {
        next();
        return;
    }

    if (req.body.message.trim() === '' || req.body.message.trim().length < 10) {
        req.flash('error', 'Your post should not be blank, should be at least 10 characters long.');
        res.redirect(req.url + '#form');
        return;
    }

    var postData = {
        message: req.body.message.trim(),
        owner: req.user._id,
        thread: req.body._id
    };

    var p = new models.Post(postData);
    p.save(function(err, post) {
        if (!err) {
            // Update user's posts sub documents
            req.user.updatePosts(post._id);
            // Update thread's post sub documents
            models.Thread.findOneAndUpdate({
                _id: req.body._id
            }, {
                $push: {
                    posts: post._id
                }
            }, function(err, th) {
                if (!err && th) {
                    req.flash('info', 'Post successfully added!');
                    res.redirect(req.url + '#form');
                }
            });
            // Update post's owner
        } else {
            req.flash('error', 'Invalid post. Your post should not contain any html tag use markdown instead.');
            res.redirect(req.url + '#form');
            return;
        }
    });
};
